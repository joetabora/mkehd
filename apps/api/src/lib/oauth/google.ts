import { config } from '../config.js';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file'
];

export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
};

type GoogleCalendarPayload = {
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

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: GOOGLE_SCOPES.join(' '),
    state
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(code: string): Promise<OAuthTokenResult> {
  const body = new URLSearchParams({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const json = await parseJsonOrThrow(response, 'Google token exchange');

  return {
    accessToken: String(json.access_token ?? ''),
    refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    tokenType: json.token_type ? String(json.token_type) : undefined,
    scope: json.scope ? String(json.scope) : undefined
  };
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    grant_type: 'refresh_token'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const json = await parseJsonOrThrow(response, 'Google token refresh');

  return {
    accessToken: String(json.access_token ?? ''),
    expiresIn: json.expires_in ? Number(json.expires_in) : undefined,
    tokenType: json.token_type ? String(json.token_type) : undefined,
    scope: json.scope ? String(json.scope) : undefined
  };
}

export async function getGoogleProfile(accessToken: string): Promise<{
  providerAccountId: string;
  email: string;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const json = await parseJsonOrThrow(response, 'Google profile fetch');

  return {
    providerAccountId: String(json.sub ?? ''),
    email: String(json.email ?? '')
  };
}

export async function upsertGoogleCalendarEvent(
  accessToken: string,
  existingExternalEventId: string | null,
  payload: GoogleCalendarPayload
): Promise<{ externalEventId: string; webUrl?: string }> {
  const body = {
    summary: payload.summary,
    description: payload.description,
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
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingExternalEventId}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (existingExternalEventId && response.status === 404) {
    return upsertGoogleCalendarEvent(accessToken, null, payload);
  }

  const json = await parseJsonOrThrow(response, 'Google calendar upsert');

  return {
    externalEventId: String(json.id ?? ''),
    webUrl: json.htmlLink ? String(json.htmlLink) : undefined
  };
}

export async function listGoogleDriveFiles(
  accessToken: string,
  folderId?: string
): Promise<{
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    webViewLink?: string;
    modifiedTime?: string;
  }>;
  nextPageToken?: string;
}> {
  const q = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';

  const params = new URLSearchParams({
    pageSize: '50',
    q,
    fields: 'nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)'
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const json = await parseJsonOrThrow(response, 'Google Drive list files');
  const files = Array.isArray(json.files) ? json.files : [];

  return {
    files: files.map((file) => {
      const item = file as Record<string, unknown>;
      return {
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        mimeType: String(item.mimeType ?? ''),
        webViewLink: item.webViewLink ? String(item.webViewLink) : undefined,
        modifiedTime: item.modifiedTime ? String(item.modifiedTime) : undefined
      };
    }),
    nextPageToken: json.nextPageToken ? String(json.nextPageToken) : undefined
  };
}

export async function getGoogleDriveFileMetadata(
  accessToken: string,
  fileId: string
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
}> {
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,webViewLink'
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  const json = await parseJsonOrThrow(response, 'Google Drive file metadata');

  return {
    id: String(json.id ?? ''),
    name: String(json.name ?? ''),
    mimeType: String(json.mimeType ?? 'application/octet-stream'),
    webViewLink: json.webViewLink ? String(json.webViewLink) : undefined
  };
}

function getGoogleExportMimeType(mimeType: string): string | null {
  if (mimeType === 'application/vnd.google-apps.document') {
    return 'application/pdf';
  }
  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    return 'text/csv';
  }
  if (mimeType === 'application/vnd.google-apps.presentation') {
    return 'application/pdf';
  }
  return null;
}

export async function downloadGoogleDriveFile(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<{ bytes: Buffer; mimeType: string }> {
  const exportMimeType = getGoogleExportMimeType(mimeType);
  const url = exportMimeType
    ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMimeType)}`
    : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Drive download failed (${response.status}): ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType: exportMimeType ?? mimeType
  };
}
