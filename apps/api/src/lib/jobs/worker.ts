import { IntegrationProvider, SyncJobType } from '@prisma/client';
import { z } from 'zod';
import { syncCalendarEventForProvider } from '../calendarSync.js';
import { prisma } from '../prisma.js';

const calendarPayloadSchema = z.object({
  eventId: z.string().min(1),
  provider: z.nativeEnum(IntegrationProvider),
  userId: z.string().min(1)
});

const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 60_000;

let workerRunning = false;

export async function enqueueCalendarSyncJobs(params: {
  requestedById: string;
  eventId: string;
  providers: IntegrationProvider[];
}) {
  const jobs = await prisma.$transaction(
    params.providers.map((provider) =>
      prisma.syncJob.create({
        data: {
          type: SyncJobType.CALENDAR_SYNC,
          requestedById: params.requestedById,
          payload: {
            eventId: params.eventId,
            provider,
            userId: params.requestedById
          }
        }
      })
    )
  );

  return jobs;
}

async function processJob(jobId: string) {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'PROCESSING') {
    return;
  }

  try {
    switch (job.type) {
      case SyncJobType.CALENDAR_SYNC: {
        const payload = calendarPayloadSchema.parse(job.payload);
        const result = await syncCalendarEventForProvider(payload);

        await prisma.syncJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            result,
            attempts: { increment: 1 },
            finishedAt: new Date(),
            error: null
          }
        });

        break;
      }
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown job failure';
    const attempts = job.attempts + 1;

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: attempts >= RETRY_LIMIT ? 'FAILED' : 'PENDING',
        attempts,
        error: message,
        runAt: attempts >= RETRY_LIMIT ? job.runAt : new Date(Date.now() + RETRY_DELAY_MS),
        finishedAt: attempts >= RETRY_LIMIT ? new Date() : null
      }
    });
  }
}

async function claimNextJob() {
  const nextJob = await prisma.syncJob.findFirst({
    where: {
      status: 'PENDING',
      runAt: { lte: new Date() }
    },
    orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }]
  });

  if (!nextJob) {
    return null;
  }

  const claimed = await prisma.syncJob.updateMany({
    where: {
      id: nextJob.id,
      status: 'PENDING'
    },
    data: {
      status: 'PROCESSING',
      startedAt: new Date()
    }
  });

  if (claimed.count === 0) {
    return null;
  }

  return nextJob.id;
}

async function tick() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;
  try {
    const nextJobId = await claimNextJob();
    if (nextJobId) {
      await processJob(nextJobId);
    }
  } finally {
    workerRunning = false;
  }
}

export function startSyncJobWorker() {
  const interval = setInterval(() => {
    void tick();
  }, 3000);

  void tick();

  return () => clearInterval(interval);
}
