import { FormEvent, useEffect, useMemo, useState } from 'react';
import { EventCard } from './components/EventCard';
import { api } from './lib.api';
import type { EventItem } from './types';

type ConnectedAccount = {
  id: string;
  provider: 'GOOGLE' | 'MICROSOFT';
  email: string | null;
  scope: string | null;
  expiresAt: string | null;
};

type SyncJob = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error: string | null;
  createdAt: string;
};

export function App() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [googleFiles, setGoogleFiles] = useState<Array<{ id: string; name: string; mimeType: string }>>([]);
  const [oneDriveFiles, setOneDriveFiles] = useState<
    Array<{ id: string; name: string; mimeType: string; isFolder: boolean }>
  >([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [title, setTitle] = useState('Monthly Rider Rally');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 16));
  const [goalQrScans, setGoalQrScans] = useState<number>(35);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventResult, accountResult, jobResult] = await Promise.all([
        api.getEvents(),
        api.getIntegrationAccounts(),
        api.listJobs()
      ]);
      setEvents(eventResult);
      setAccounts(accountResult);
      setJobs(jobResult);
      if (!selectedEventId && eventResult.length > 0) {
        setSelectedEventId(eventResult[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const integration = params.get('integration');
    const message = params.get('message');

    if (status && integration) {
      if (status === 'success') {
        setNotice(`${integration.toUpperCase()} integration connected.`);
      } else {
        setError(message ?? `Failed to connect ${integration}.`);
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    }

    void refresh();
  }, []);

  const onCreateEvent = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    try {
      const created = await api.createEvent({
        title,
        eventDate: new Date(eventDate).toISOString(),
        goalQrScans
      });
      setSelectedEventId(created.id);
      setNotice('Event created.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  const onGenerateTasks = async (eventId: string) => {
    try {
      await api.generateTemplateTasks(eventId);
      setNotice('Template tasks generated.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tasks');
    }
  };

  const onRequestApproval = async (eventId: string) => {
    try {
      await api.createCheckRequestApproval(eventId);
      setNotice('Check request approval submitted.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request approval');
    }
  };

  const connectGoogle = async () => {
    setError(null);
    const result = await api.getGoogleAuthUrl();
    window.location.href = result.url;
  };

  const connectMicrosoft = async () => {
    setError(null);
    const result = await api.getMicrosoftAuthUrl();
    window.location.href = result.url;
  };

  const queueSync = async (providers: Array<'GOOGLE' | 'MICROSOFT' | 'ICLOUD_ICS'>) => {
    if (!selectedEventId) {
      setError('Select an event first.');
      return;
    }

    try {
      await api.queueCalendarSync({ eventId: selectedEventId, providers });
      setNotice('Calendar sync jobs queued.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue sync');
    }
  };

  const loadGoogleFiles = async () => {
    try {
      const result = await api.listGoogleDriveFiles();
      setGoogleFiles(result.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list Google Drive files');
    }
  };

  const loadOneDriveFiles = async () => {
    try {
      const result = await api.listOneDriveFiles();
      setOneDriveFiles(result.files.filter((item) => !item.isFolder));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list OneDrive files');
    }
  };

  const importGoogleFile = async (fileId: string) => {
    if (!selectedEventId) {
      setError('Select an event first.');
      return;
    }

    try {
      await api.importGoogleDriveFile({ eventId: selectedEventId, fileId });
      setNotice('Google Drive file imported to event documents.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import Google Drive file');
    }
  };

  const importOneDriveFile = async (itemId: string) => {
    if (!selectedEventId) {
      setError('Select an event first.');
      return;
    }

    try {
      await api.importOneDriveFile({ eventId: selectedEventId, itemId });
      setNotice('OneDrive file imported to event documents.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import OneDrive file');
    }
  };

  return (
    <main className="layout">
      <section className="hero">
        <p className="kicker">Milwaukee Harley-Davidson</p>
        <h1>Event Ops Command Center</h1>
        <p>
          Indoor and outdoor event workflows with approvals, lead capture, calendar sync, and cloud file imports.
        </p>
      </section>

      <section className="panel">
        <h2>Create Event</h2>
        <form onSubmit={onCreateEvent} className="event-form">
          <label>
            Event Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
          </label>
          <label>
            Event Date
            <input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </label>
          <label>
            QR Goal
            <input
              type="number"
              min={1}
              value={goalQrScans}
              onChange={(e) => setGoalQrScans(Number(e.target.value))}
            />
          </label>
          <button type="submit">Create Event</button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Integrations</h2>
          <button className="secondary" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>

        <div className="integrations-grid">
          <div className="integration-card">
            <h3>Calendar Connections</h3>
            <div className="actions inline">
              <button onClick={() => void connectGoogle()}>Connect Google</button>
              <button onClick={() => void connectMicrosoft()}>Connect Microsoft</button>
            </div>
            <ul className="list">
              {accounts.map((account) => (
                <li key={account.id}>
                  {account.provider} {account.email ? `(${account.email})` : ''}
                </li>
              ))}
              {accounts.length === 0 ? <li>No integrations connected yet.</li> : null}
            </ul>
          </div>

          <div className="integration-card">
            <h3>Sync Jobs</h3>
            <label>
              Event for sync
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                disabled={events.length === 0}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions inline">
              <button onClick={() => void queueSync(['GOOGLE', 'MICROSOFT'])}>Sync Google + Microsoft</button>
              <button className="secondary" onClick={() => void queueSync(['ICLOUD_ICS'])}>
                Queue iPhone Feed Export
              </button>
            </div>
            <ul className="list">
              {jobs.map((job) => (
                <li key={job.id}>
                  {job.status} at {new Date(job.createdAt).toLocaleString()}
                  {job.error ? ` - ${job.error}` : ''}
                </li>
              ))}
              {jobs.length === 0 ? <li>No sync jobs yet.</li> : null}
            </ul>
          </div>

          <div className="integration-card">
            <h3>Google Drive Import</h3>
            <div className="actions inline">
              <button onClick={() => void loadGoogleFiles()}>Load Files</button>
            </div>
            <ul className="list">
              {googleFiles.map((file) => (
                <li key={file.id}>
                  <span>{file.name}</span>
                  <button className="secondary" onClick={() => void importGoogleFile(file.id)}>
                    Import
                  </button>
                </li>
              ))}
              {googleFiles.length === 0 ? <li>No files loaded.</li> : null}
            </ul>
          </div>

          <div className="integration-card">
            <h3>OneDrive Import</h3>
            <div className="actions inline">
              <button onClick={() => void loadOneDriveFiles()}>Load Files</button>
            </div>
            <ul className="list">
              {oneDriveFiles.map((file) => (
                <li key={file.id}>
                  <span>{file.name}</span>
                  <button className="secondary" onClick={() => void importOneDriveFile(file.id)}>
                    Import
                  </button>
                </li>
              ))}
              {oneDriveFiles.length === 0 ? <li>No files loaded.</li> : null}
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Event Pipeline</h2>
          <p>{selectedEvent ? `Selected event: ${selectedEvent.title}` : 'No event selected'}</p>
        </div>

        {loading ? <p>Loading events...</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        <div className="event-grid">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onGenerateTasks={(id) => void onGenerateTasks(id)}
              onRequestApproval={(id) => void onRequestApproval(id)}
            />
          ))}
          {events.length === 0 && !loading ? <p>No events yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
