import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { requireApprover, requireUser } from '../middleware/auth.js';

export const approvalsRouter = Router();

const checkRequestSchema = z.object({
  eventId: z.string().min(1)
});

approvalsRouter.post('/check-request', requireUser, async (req, res) => {
  const parsed = checkRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const approval = await prisma.approval.create({
    data: {
      eventId: event.id,
      type: ApprovalType.CHECK_REQUEST,
      requestedById: req.user!.id,
      approverEmail: config.defaultApproverEmail,
      status: ApprovalStatus.PENDING
    }
  });

  res.status(201).json(approval);
});

approvalsRouter.post('/:id/approve', requireUser, requireApprover, async (req, res) => {
  const approval = await prisma.approval.findUnique({ where: { id: req.params.id } });
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  if (req.user!.email.toLowerCase() !== approval.approverEmail.toLowerCase()) {
    return res.status(403).json({ error: `Only ${approval.approverEmail} can approve this request.` });
  }

  const updated = await prisma.approval.update({
    where: { id: approval.id },
    data: {
      status: ApprovalStatus.APPROVED,
      decidedAt: new Date()
    }
  });

  res.json(updated);
});

approvalsRouter.post('/:id/reject', requireUser, requireApprover, async (req, res) => {
  const approval = await prisma.approval.findUnique({ where: { id: req.params.id } });
  if (!approval) {
    return res.status(404).json({ error: 'Approval not found' });
  }

  if (req.user!.email.toLowerCase() !== approval.approverEmail.toLowerCase()) {
    return res.status(403).json({ error: `Only ${approval.approverEmail} can reject this request.` });
  }

  const updated = await prisma.approval.update({
    where: { id: approval.id },
    data: {
      status: ApprovalStatus.REJECTED,
      decidedAt: new Date()
    }
  });

  res.json(updated);
});
