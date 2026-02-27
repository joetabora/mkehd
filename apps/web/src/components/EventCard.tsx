import type { EventItem } from '../types';

type Props = {
  event: EventItem;
  onGenerateTasks: (id: string) => void;
  onRequestApproval: (id: string) => void;
};

export function EventCard({ event, onGenerateTasks, onRequestApproval }: Props) {
  return (
    <article className="event-card">
      <header>
        <h3>{event.title}</h3>
        <span className={`pill ${event.seasonType.toLowerCase()}`}>{event.seasonType}</span>
      </header>
      <p>
        <strong>Date:</strong> {new Date(event.eventDate).toLocaleString()}
      </p>
      <p>
        <strong>Status:</strong> {event.status}
      </p>
      <p>
        <strong>QR Goal:</strong> {event.goalQrScans ?? 'N/A'}
      </p>
      <p>
        <strong>Leads:</strong> {event.leads.length}
      </p>
      <p>
        <strong>Approvals:</strong> {event.approvals.length}
      </p>
      <div className="actions">
        <button onClick={() => onGenerateTasks(event.id)}>Generate Tasks</button>
        <button className="secondary" onClick={() => onRequestApproval(event.id)}>
          Request Check Approval
        </button>
      </div>
    </article>
  );
}
