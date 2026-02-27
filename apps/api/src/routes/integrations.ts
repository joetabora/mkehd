import { DocumentType, IntegrationProvider, StorageProvider } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { persistImportedDriveFile } from '../lib/driveImport.js';
import {
  ensureFreshAccessToken,
  getUserIntegrationAccount,
  upsertIntegrationAccount
} from '../lib/integrationAccounts.js';
import { enqueueCalendarSyncJobs } from '../lib/jobs/worker.js';
import { verifyOAuthState, createOAuthState } from '../lib/oauthState.js';
import {
  downloadGoogleDriveFile,
  exchangeGoogleAuthCode,
  getGoogleAuthUrl,
  getGoogleDriveFileMetadata,
  getGoogleProfile,
  listGoogleDriveFiles
} from '../lib/oauth/google.js';
import {
  downloadOneDriveFile,
  exchangeMicrosoftAuthCode,
  getMicrosoftAuthUrl,
  getMicrosoftProfile,
  listOneDriveFiles
} from '../lib/oauth/microsoft.js';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../middleware/auth.js';

export const integrationsRouter = Router();

const syncSchema = z.object({
  eventId: z.string().min(1),
  providers: z.array(z.enum(['GOOGLE', 'MICROSOFT', 'ICLOUD_ICS'])).min(1)
});

const googleImportSchema = z.object({
  eventId: z.string().min(1),
  fileId: z.string().min(1),
  documentType: z.nativeEnum(DocumentType).optional()
});

const oneDriveImportSchema = z.object({
  eventId: z.string().min(1),
  itemId: z.string().min(1),
  documentType: z.nativeEnum(DocumentType).optional()
});

function ensureOAuthConfig(provider: IntegrationProvider) {
  if (provider === IntegrationProvider.GOOGLE) {
    if (!config.google.clientId || !config.google.clientSecret) {
      throw new Error('Google OAuth env vars are not configured.');
    }
    return;
  }

  if (!config.microsoft.clientId || !config.microsoft.clientSecret) {
    throw new Error('Microsoft OAuth env vars are not configured.');
  }
}

function redirectWithStatus(provider: 'google' | 'microsoft', status: 'success' | 'error', message?: string) {
  const url = new URL(config.frontendUrl);
  url.searchParams.set('integration', provider);
  url.searchParams.set('status', status);
  if (message) {
    url.searchParams.set('message', message);
  }
  return url.toString();
}

integrationsRouter.get('/accounts', requireUser, async (req, res) => {
  const accounts = await prisma.integrationAccount.findMany({
    where: { userId: req.user!.id },
    select: {
      id: true,
      provider: true,
      email: true,
      scope: true,
      expiresAt: true,
      updatedAt: true
    }
  });

  res.json(accounts);
});

integrationsRouter.get('/calendars/google/auth-url', requireUser, async (req, res) => {
  try {
    ensureOAuthConfig(IntegrationProvider.GOOGLE);
    const state = createOAuthState(req.user!.id, 'GOOGLE');
    res.json({ url: getGoogleAuthUrl(state) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Google auth URL';
    res.status(400).json({ error: message });
  }
});

integrationsRouter.get('/calendars/microsoft/auth-url', requireUser, async (req, res) => {
  try {
    ensureOAuthConfig(IntegrationProvider.MICROSOFT);
    const state = createOAuthState(req.user!.id, 'MICROSOFT');
    res.json({ url: getMicrosoftAuthUrl(state) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Microsoft auth URL';
    res.status(400).json({ error: message });
  }
});

integrationsRouter.get('/oauth/callback/google', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const err = typeof req.query.error === 'string' ? req.query.error : '';

  if (err) {
    return res.redirect(redirectWithStatus('google', 'error', err));
  }

  try {
    ensureOAuthConfig(IntegrationProvider.GOOGLE);
    if (!code || !state) {
      throw new Error('Missing OAuth callback parameters.');
    }

    const parsedState = verifyOAuthState(state);
    if (parsedState.provider !== 'GOOGLE') {
      throw new Error('OAuth provider mismatch in callback state.');
    }

    const token = await exchangeGoogleAuthCode(code);
    const profile = await getGoogleProfile(token.accessToken);

    await upsertIntegrationAccount({
      userId: parsedState.userId,
      provider: IntegrationProvider.GOOGLE,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scope: token.scope,
      expiresIn: token.expiresIn
    });

    return res.redirect(redirectWithStatus('google', 'success'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google OAuth callback failed';
    return res.redirect(redirectWithStatus('google', 'error', message));
  }
});

integrationsRouter.get('/oauth/callback/microsoft', async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const err = typeof req.query.error === 'string' ? req.query.error : '';

  if (err) {
    return res.redirect(redirectWithStatus('microsoft', 'error', err));
  }

  try {
    ensureOAuthConfig(IntegrationProvider.MICROSOFT);
    if (!code || !state) {
      throw new Error('Missing OAuth callback parameters.');
    }

    const parsedState = verifyOAuthState(state);
    if (parsedState.provider !== 'MICROSOFT') {
      throw new Error('OAuth provider mismatch in callback state.');
    }

    const token = await exchangeMicrosoftAuthCode(code);
    const profile = await getMicrosoftProfile(token.accessToken);

    await upsertIntegrationAccount({
      userId: parsedState.userId,
      provider: IntegrationProvider.MICROSOFT,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      tokenType: token.tokenType,
      scope: token.scope,
      expiresIn: token.expiresIn
    });

    return res.redirect(redirectWithStatus('microsoft', 'success'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Microsoft OAuth callback failed';
    return res.redirect(redirectWithStatus('microsoft', 'error', message));
  }
});

integrationsRouter.post('/calendars/sync', requireUser, async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  const providersToQueue = parsed.data.providers.filter((provider) => provider !== 'ICLOUD_ICS');
  const queued =
    providersToQueue.length > 0
      ? await enqueueCalendarSyncJobs({
          requestedById: req.user!.id,
          eventId: parsed.data.eventId,
          providers: providersToQueue as IntegrationProvider[]
        })
      : [];

  res.status(202).json({
    message: 'Sync jobs queued.',
    queuedJobs: queued.map((job) => ({ id: job.id, type: job.type, status: job.status })),
    notes:
      parsed.data.providers.includes('ICLOUD_ICS')
        ? ['ICLOUD_ICS currently supports feed export only (write sync not yet implemented).']
        : []
  });
});

integrationsRouter.get('/jobs', requireUser, async (req, res) => {
  const jobs = await prisma.syncJob.findMany({
    where: { requestedById: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  res.json(jobs);
});

integrationsRouter.get('/drives/google/files', requireUser, async (req, res) => {
  try {
    const account = await getUserIntegrationAccount(req.user!.id, IntegrationProvider.GOOGLE);
    if (!account) {
      return res.status(404).json({ error: 'Google integration not connected.' });
    }

    const accessToken = await ensureFreshAccessToken(account.id);
    const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;

    const result = await listGoogleDriveFiles(accessToken, folderId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list Google Drive files';
    return res.status(400).json({ error: message });
  }
});

integrationsRouter.get('/drives/onedrive/files', requireUser, async (req, res) => {
  try {
    const account = await getUserIntegrationAccount(req.user!.id, IntegrationProvider.MICROSOFT);
    if (!account) {
      return res.status(404).json({ error: 'Microsoft integration not connected.' });
    }

    const accessToken = await ensureFreshAccessToken(account.id);
    const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;

    const result = await listOneDriveFiles(accessToken, folderId);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list OneDrive files';
    return res.status(400).json({ error: message });
  }
});

integrationsRouter.post('/drives/google/import', requireUser, async (req, res) => {
  const parsed = googleImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  try {
    const account = await getUserIntegrationAccount(req.user!.id, IntegrationProvider.GOOGLE);
    if (!account) {
      return res.status(404).json({ error: 'Google integration not connected.' });
    }

    const accessToken = await ensureFreshAccessToken(account.id);
    const metadata = await getGoogleDriveFileMetadata(accessToken, parsed.data.fileId);
    const downloaded = await downloadGoogleDriveFile(accessToken, metadata.id, metadata.mimeType);

    const doc = await persistImportedDriveFile({
      eventId: parsed.data.eventId,
      uploadedById: req.user!.id,
      provider: StorageProvider.GDRIVE,
      fileName: metadata.name,
      mimeType: downloaded.mimeType,
      bytes: downloaded.bytes,
      externalId: metadata.id,
      externalUrl: metadata.webViewLink,
      documentType: parsed.data.documentType
    });

    return res.status(201).json(doc);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import file from Google Drive';
    return res.status(400).json({ error: message });
  }
});

integrationsRouter.post('/drives/onedrive/import', requireUser, async (req, res) => {
  const parsed = oneDriveImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found.' });
  }

  try {
    const account = await getUserIntegrationAccount(req.user!.id, IntegrationProvider.MICROSOFT);
    if (!account) {
      return res.status(404).json({ error: 'Microsoft integration not connected.' });
    }

    const accessToken = await ensureFreshAccessToken(account.id);
    const downloaded = await downloadOneDriveFile(accessToken, parsed.data.itemId);

    const doc = await persistImportedDriveFile({
      eventId: parsed.data.eventId,
      uploadedById: req.user!.id,
      provider: StorageProvider.ONEDRIVE,
      fileName: downloaded.name,
      mimeType: downloaded.mimeType,
      bytes: downloaded.bytes,
      externalId: parsed.data.itemId,
      externalUrl: downloaded.webUrl,
      documentType: parsed.data.documentType
    });

    return res.status(201).json(doc);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import file from OneDrive';
    return res.status(400).json({ error: message });
  }
});
