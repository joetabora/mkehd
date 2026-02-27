import { config } from '../config.js';

const MICROSOFT_AUTH_BASE = 'https://login.microsoftonline.com';

const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Calendars.ReadWrite',
  'Files.Read',
  'Files.ReadWrite'
];

export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
};

type MicrosoftCalendarPayload = {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  timeZone: string;
};

async function parseJsonOrThrow(response: Response, context: string) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${context} failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function getTokenUrl(): string {
  return `${MICROSOFT_AUTH_BASE}/${config.microsoft.tenantId}/oauth2/v2.0/token`;
}

export function getMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.microsoft.clientId,
    response_type: 'code',
    redirect_uri: config.microsoft.redirectUri,
    response_mode: 'query',
    scope: MICROSOFT_SCOPES.join(' '),
    state
  });

  return `${MICROSOFT_AUTH_BASE}/${config.microsoft.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftAuthCode(code: string): Promise<OAuthTokenResult> {
  const body = new URLSearchParams({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    code,
    redirect_uri: config.microsoft.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const json = await parseJsonOrThrow(response, 'Microsoft token exchange');

  return {
    accessToken: String(json.access_token ?? ''),
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    tokenType: json.token_type ? String(json.token_type) : undefined,
    scope: json.scope ? String(json.scope) : undefined
  };
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
  const body = new URLSearchParams({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    refresh_token: refreshToken,
    redirect_uri: config.microsoft.redirectUri,
    grant_type: 'refresh_token'
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const json = await parseJsonOrThrow(response, 'Microsoft token refresh');

  return {
    accessToken: String(json.access_token ?? ''),
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    tokenType: json.token_type ? String(json.token_type) : undefined,
    scope: json.scope ? String(json.scope) : undefined
  };
}

export async function getMicrosoftProfile(accessToken: string): Promise<{
  providerAccountId: string;
  email: string;
}> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const json = await parseJsonOrThrow(response, 'Microsoft profile fetch');
  const email = String(json.mail ?? json.userPrincipalName ?? '');

  return {
    providerAccountId: String(json.id ?? ''),
    email
  };
}

export async function upsertMicrosoftCalendarEvent(
  accessToken: string,
  existingExternalEventId: string | null,
  payload: MicrosoftCalendarPayload
): Promise<{ externalEventId: string; webUrl?: string }> {
  const body = {
    subject: payload.summary,
    body: {
      contentType: 'text',
      content: payload.description
    },
    start: {
      dateTime: payload.startIso,
      timeZone: payload.timeZone
    },
    end: {
      dateTime: payload.endIso,
      timeZone: payload.timeZone
    }
  };

  const method = existingExternalEventId ? 'PATCH' : 'POST';
  const url = existingExternalEventId
    ? `https://graph.microsoft.com/v1.0/me/events/${existingExternalEventId}`
    : 'https://graph.microsoft.com/v1.0/me/events';

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (existingExternalEventId && response.status === 404) {
    return upsertMicrosoftCalendarEvent(accessToken, null, payload);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft calendar upsert failed (${response.status}): ${text}`);
  }

  if (method === 'PATCH') {
    return {
      externalEventId: existingExternalEventId!,
      webUrl: undefined
    };
  }

  const json = (await response.json()) as Record<string, unknown>;

  return {
    externalEventId: String(json.id ?? ''),
    webUrl: json.webLink ? String(json.webLink) : undefined
  };
}

export async function listOneDriveFiles(
  accessToken: string,
  folderId?: string
): Promise<{
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    webUrl?: string;
    lastModifiedDateTime?: string;
    isFolder: boolean;
  }>;
}> {
  const url = folderId
    ? `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children?$top=50`
    : 'https://graph.microsoft.com/v1.0/me/drive/root/children?$top=50';

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const json = await parseJsonOrThrow(response, 'OneDrive list files');
  const value = Array.isArray(json.value) ? json.value : [];

  return {
    files: value.map((entry) => {
      const item = entry as Record<string, unknown>;
      const file = item.file as Record<string, unknown> | undefined;
      const folder = item.folder as Record<string, unknown> | undefined;

      return {
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        mimeType: String(file?.mimeType ?? 'application/octet-stream'),
        webUrl: item.webUrl ? String(item.webUrl) : undefined,
        lastModifiedDateTime: item.lastModifiedDateTime
          ? String(item.lastModifiedDateTime)
          : undefined,
        isFolder: Boolean(folder)
      };
    })
  };
}

export async function downloadOneDriveFile(
  accessToken: string,
  itemId: string
): Promise<{ bytes: Buffer; mimeType: string; name: string; webUrl?: string }> {
  const metadataResponse = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}?$select=id,name,webUrl,file,@microsoft.graph.downloadUrl`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const metadata = await parseJsonOrThrow(metadataResponse, 'OneDrive metadata fetch');
  const downloadUrl = metadata['@microsoft.graph.downloadUrl'];
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    throw new Error('OneDrive item is not directly downloadable.');
  }

  const fileInfo = (metadata.file ?? {}) as Record<string, unknown>;
  const mimeType = String(fileInfo.mimeType ?? 'application/octet-stream');

  const fileResponse = await fetch(downloadUrl);
  if (!fileResponse.ok) {
    const text = await fileResponse.text();
    throw new Error(`OneDrive file download failed (${fileResponse.status}): ${text}`);
  }

  const bytes = Buffer.from(await fileResponse.arrayBuffer());

  return {
    bytes,
    mimeType,
    name: String(metadata.name ?? 'onedrive-file'),
    webUrl: metadata.webUrl ? String(metadata.webUrl) : undefined
  };
}
