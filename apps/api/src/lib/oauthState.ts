import crypto from 'node:crypto';
import { config } from './config.js';

const TTL_MS = 10 * 60 * 1000;

type StatePayload = {
  userId: string;
  provider: 'GOOGLE' | 'MICROSOFT';
  nonce: string;
  issuedAt: number;
};

function sign(data: string): string {
  return crypto.createHmac('sha256', config.oauthStateSecret).update(data).digest('base64url');
}

export function createOAuthState(userId: string, provider: 'GOOGLE' | 'MICROSOFT'): string {
  const payload: StatePayload = {
    userId,
    provider,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now()
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyOAuthState(state: string): StatePayload {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('Invalid OAuth state value.');
  }

  const expected = sign(encodedPayload);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid OAuth state signature.');
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as StatePayload;
  if (!payload.userId || !payload.provider || !payload.issuedAt) {
    throw new Error('Malformed OAuth state payload.');
  }

  if (Date.now() - payload.issuedAt > TTL_MS) {
    throw new Error('OAuth state expired.');
  }

  return payload;
}
