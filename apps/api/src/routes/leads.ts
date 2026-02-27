import { LeadSource } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const leadsRouter = Router();

const qrSchema = z.object({
  eventId: z.string().min(1),
  contactRef: z.string().optional()
});

leadsRouter.post('/qr-webhook', async (req, res) => {
  const parsed = qrSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const lead = await prisma.leadCapture.create({
    data: {
      eventId: parsed.data.eventId,
      source: LeadSource.QR_FORM,
      contactRef: parsed.data.contactRef
    }
  });

  res.status(201).json(lead);
});
