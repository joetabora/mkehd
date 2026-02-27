import type { EventItem } from './types';

const API_BASE = 'http://localhost:4000';
const USER_EMAIL = 'joe@dealership.local';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': USER_EMAIL,
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  getEvents: () => request<EventItem[]>('/events'),
  getIntegrationAccounts: () =>
    request<
      Array<{
        id: string;
        provider: 'GOOGLE' | 'MICROSOFT';
        email: string | null;
        scope: string | null;
        expiresAt: string | null;
      }>
    >('/integrations/accounts'),
  getGoogleAuthUrl: () => request<{ url: string }>('/integrations/calendars/google/auth-url'),
  getMicrosoftAuthUrl: () =>
    request<{ url: string }>('/integrations/calendars/microsoft/auth-url'),
  queueCalendarSync: (payload: {
    eventId: string;
    providers: Array<'GOOGLE' | 'MICROSOFT' | 'ICLOUD_ICS'>;
  }) => request('/integrations/calendars/sync', { method: 'POST', body: JSON.stringify(payload) }),
  listJobs: () =>
    request<
      Array<{
        id: string;
        status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
        error: string | null;
        createdAt: string;
      }>
    >('/integrations/jobs'),
  listGoogleDriveFiles: () =>
    request<{
      files: Array<{ id: string; name: string; mimeType: string; webViewLink?: string }>;
    }>('/integrations/drives/google/files'),
  listOneDriveFiles: () =>
    request<{
      files: Array<{ id: string; name: string; mimeType: string; webUrl?: string; isFolder: boolean }>;
    }>('/integrations/drives/onedrive/files'),
  importGoogleDriveFile: (payload: { eventId: string; fileId: string }) =>
    request('/integrations/drives/google/import', { method: 'POST', body: JSON.stringify(payload) }),
  importOneDriveFile: (payload: { eventId: string; itemId: string }) =>
    request('/integrations/drives/onedrive/import', { method: 'POST', body: JSON.stringify(payload) }),
  createEvent: (payload: { title: string; eventDate: string; goalQrScans?: number }) =>
    request<EventItem>('/events', { method: 'POST', body: JSON.stringify(payload) }),
  generateTemplateTasks: (eventId: string) =>
    request(`/events/${eventId}/generate-tasks-from-template`, { method: 'POST' }),
  createCheckRequestApproval: (eventId: string) =>
    request('/approvals/check-request', { method: 'POST', body: JSON.stringify({ eventId }) })
};
