import { IntegrationProvider } from '@prisma/client';
import { ensureFreshAccessToken, getUserIntegrationAccount } from './integrationAccounts.js';
import { upsertGoogleCalendarEvent } from './oauth/google.js';
import { upsertMicrosoftCalendarEvent } from './oauth/microsoft.js';
import { prisma } from './prisma.js';

function getCalendarPayload(event: { title: string; eventDate: Date; seasonType: string }) {
  const start = new Date(event.eventDate);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  return {
    summary: event.title,
    description: `MKEHD Event (${event.seasonType})`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timeZone: 'America/Chicago'
  };
}

export async function syncCalendarEventForProvider(params: {
  userId: string;
  eventId: string;
  provider: IntegrationProvider;
}) {
  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event) {
    throw new Error('Event not found for sync job.');
  }

  const account = await getUserIntegrationAccount(params.userId, params.provider);
  if (!account) {
    throw new Error(`No ${params.provider} integration account connected.`);
  }

  const existing = await prisma.calendarEventSync.findUnique({
    where: {
      eventId_integrationAccountId_provider: {
        eventId: event.id,
        integrationAccountId: account.id,
        provider: params.provider
      }
    }
  });

  const accessToken = await ensureFreshAccessToken(account.id);
  const payload = getCalendarPayload(event);

  const response =
    params.provider === IntegrationProvider.GOOGLE
      ? await upsertGoogleCalendarEvent(accessToken, existing?.externalEventId ?? null, payload)
      : await upsertMicrosoftCalendarEvent(accessToken, existing?.externalEventId ?? null, payload);

  const syncRecord = await prisma.calendarEventSync.upsert({
    where: {
      eventId_integrationAccountId_provider: {
        eventId: event.id,
        integrationAccountId: account.id,
        provider: params.provider
      }
    },
    update: {
      externalEventId: response.externalEventId
    },
    create: {
      eventId: event.id,
      integrationAccountId: account.id,
      provider: params.provider,
      externalEventId: response.externalEventId
    }
  });

  return {
    eventId: event.id,
    provider: params.provider,
    externalEventId: syncRecord.externalEventId,
    webUrl: response.webUrl
  };
}
