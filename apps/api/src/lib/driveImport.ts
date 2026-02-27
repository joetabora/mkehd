import { DocumentType, StorageProvider } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';

const uploadDir = path.resolve('apps/api/uploads');

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function persistImportedDriveFile(params: {
  eventId: string;
  uploadedById: string;
  provider: 'GDRIVE' | 'ONEDRIVE';
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  externalId: string;
  externalUrl?: string;
  documentType?: DocumentType;
}) {
  await fs.mkdir(uploadDir, { recursive: true });

  const storageKey = `${randomUUID()}-${safeName(params.fileName)}`;
  const filePath = path.join(uploadDir, storageKey);
  await fs.writeFile(filePath, params.bytes);

  const doc = await prisma.document.create({
    data: {
      eventId: params.eventId,
      uploadedById: params.uploadedById,
      provider: params.provider,
      type: params.documentType ?? DocumentType.ASSET,
      storageKey,
      originalName: params.fileName,
      mimeType: params.mimeType,
      externalId: params.externalId,
      externalUrl: params.externalUrl
    }
  });

  return doc;
}
