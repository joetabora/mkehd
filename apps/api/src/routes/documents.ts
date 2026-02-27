import { DocumentType, StorageProvider } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { requireUser } from '../middleware/auth.js';

const uploadDir = path.resolve('apps/api/uploads');
const upload = multer({ dest: uploadDir });

export const documentsRouter = Router();

documentsRouter.post('/:id/documents', requireUser, upload.single('file'), async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'File upload is required.' });
  }

  const rawType = (req.body.type as string | undefined) ?? 'ASSET';
  const type = rawType in DocumentType ? (rawType as DocumentType) : DocumentType.ASSET;

  const doc = await prisma.document.create({
    data: {
      eventId: event.id,
      type,
      provider: StorageProvider.LOCAL,
      storageKey: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedById: req.user!.id
    }
  });

  res.status(201).json(doc);
});
