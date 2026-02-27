import { EventStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { inferSeasonType } from '../lib/season.js';
import { buildTemplateTasks } from '../lib/taskTemplates.js';
import { requireUser } from '../middleware/auth.js';

export const eventsRouter = Router();

const createEventSchema = z.object({
  title: z.string().min(3),
  eventDate: z.string().datetime(),
  goalQrScans: z.number().int().positive().optional()
});

eventsRouter.post('/', requireUser, async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const eventDate = new Date(parsed.data.eventDate);
  const seasonType = inferSeasonType(eventDate);

  const event = await prisma.event.create({
    data: {
      title: parsed.data.title,
      eventDate,
      goalQrScans: parsed.data.goalQrScans,
      seasonType,
      createdById: req.user!.id
    }
  });

  res.status(201).json(event);
});

eventsRouter.get('/', requireUser, async (_req, res) => {
  const events = await prisma.event.findMany({
    include: {
      tasks: true,
      approvals: true,
      leads: true
    },
    orderBy: { eventDate: 'asc' }
  });
  res.json(events);
});

eventsRouter.get('/:id/board', requireUser, async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { tasks: { orderBy: [{ status: 'asc' }, { dueAt: 'asc' }] } }
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const board = {
    TODO: event.tasks.filter((task) => task.status === 'TODO'),
    IN_PROGRESS: event.tasks.filter((task) => task.status === 'IN_PROGRESS'),
    DONE: event.tasks.filter((task) => task.status === 'DONE'),
    BLOCKED: event.tasks.filter((task) => task.status === 'BLOCKED')
  };

  res.json({ eventId: event.id, title: event.title, board });
});

eventsRouter.post('/:id/generate-tasks-from-template', requireUser, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  const existing = await prisma.eventTask.count({ where: { eventId: event.id } });
  if (existing > 0) {
    return res.status(409).json({ error: 'Tasks already exist for this event.' });
  }

  const tasks = buildTemplateTasks(event.eventDate, event.seasonType);
  await prisma.eventTask.createMany({
    data: tasks.map((task) => ({ ...task, eventId: event.id }))
  });

  const updated = await prisma.event.findUnique({
    where: { id: event.id },
    include: { tasks: true }
  });

  if (updated && updated.tasks.length > 0) {
    await prisma.event.update({ where: { id: event.id }, data: { status: EventStatus.READY } });
  }

  res.status(201).json(updated);
});
