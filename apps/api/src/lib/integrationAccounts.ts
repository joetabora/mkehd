import { IntegrationProvider, Prisma } from '@prisma/client';
import { decryptString, encryptString } from './crypto.js';
import { prisma } from './prisma.js';
import { refreshGoogleAccessToken } from './oauth/google.js';
import { refreshMicrosoftAccessToken } from './oauth/microsoft.js';

type UpsertParams = {
  userId: string;
  provider: IntegrationProvider;
  providerAccountId?: string;
  email?: string;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresIn?: number;
};

export async function upsertIntegrationAccount(params: UpsertParams) {
  const expiresAt = params.expiresIn
    ? new Date(Date.now() + Math.max(30, params.expiresIn - 30) * 1000)
    : null;

  const existing = await prisma.integrationAccount.findUnique({
    where: {
      userId_provider: {
        userId: params.userId,
        provider: params.provider
      }
    }
  });

  const data: Prisma.IntegrationAccountUncheckedCreateInput = {
    userId: params.userId,
    provider: params.provider,
    providerAccountId: params.providerAccountId,
    email: params.email,
    accessTokenEnc: encryptString(params.accessToken),
    refreshTokenEnc: params.refreshToken
      ? encryptString(params.refreshToken)
      : existing?.refreshTokenEnc ?? null,
    tokenType: params.tokenType,
    scope: params.scope,
    expiresAt
  };

  return prisma.integrationAccount.upsert({
    where: {
      userId_provider: {
        userId: params.userId,
        provider: params.provider
      }
    },
    update: data,
    create: data
  });
}

export async function getUserIntegrationAccount(userId: string, provider: IntegrationProvider) {
  return prisma.integrationAccount.findUnique({
    where: {
      userId_provider: {
        userId,
        provider
      }
    }
  });
}

export async function ensureFreshAccessToken(accountId: string): Promise<string> {
  const account = await prisma.integrationAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    throw new Error('Integration account not found.');
  }

  const accessToken = decryptString(account.accessTokenEnc);
  const refreshToken = account.refreshTokenEnc ? decryptString(account.refreshTokenEnc) : null;

  const expiresSoon = account.expiresAt ? account.expiresAt.getTime() - Date.now() < 60_000 : false;
  if (!expiresSoon) {
    return accessToken;
  }

  if (!refreshToken) {
    throw new Error(`No refresh token available for ${account.provider} integration.`);
  }

  const refreshed =
    account.provider === IntegrationProvider.GOOGLE
      ? await refreshGoogleAccessToken(refreshToken)
      : await refreshMicrosoftAccessToken(refreshToken);

  const updated = await prisma.integrationAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: encryptString(refreshed.accessToken),
      refreshTokenEnc: refreshed.refreshToken
        ? encryptString(refreshed.refreshToken)
        : account.refreshTokenEnc,
      tokenType: refreshed.tokenType ?? account.tokenType,
      scope: refreshed.scope ?? account.scope,
      expiresAt: refreshed.expiresIn
        ? new Date(Date.now() + Math.max(30, refreshed.expiresIn - 30) * 1000)
        : account.expiresAt
    }
  });

  return decryptString(updated.accessTokenEnc);
}
