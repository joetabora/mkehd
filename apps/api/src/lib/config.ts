import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  defaultApproverEmail: process.env.DEFAULT_APPROVER_EMAIL ?? 'rachel@dealership.local',
  oauthStateSecret: process.env.OAUTH_STATE_SECRET ?? 'insecure-dev-state-secret',
  tokenEncryptionKey:
    process.env.TOKEN_ENCRYPTION_KEY ??
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/integrations/oauth/callback/google'
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
    tenantId: process.env.MICROSOFT_TENANT_ID ?? 'common',
    redirectUri:
      process.env.MICROSOFT_REDIRECT_URI ??
      'http://localhost:4000/integrations/oauth/callback/microsoft'
  }
};
