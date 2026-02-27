export type EventItem = {
  id: string;
  title: string;
  eventDate: string;
  seasonType: 'INDOOR' | 'OUTDOOR';
  status: 'DRAFT' | 'READY' | 'LIVE' | 'DONE';
  goalQrScans: number | null;
  leads: { id: string }[];
  approvals: { id: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' }[];
};
