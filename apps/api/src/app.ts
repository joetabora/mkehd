import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { config } from './lib/config.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { approvalsRouter } from './routes/approvals.js';
import { documentsRouter } from './routes/documents.js';
import { eventsRouter } from './routes/events.js';
import { integrationsRouter } from './routes/integrations.js';
import { leadsRouter } from './routes/leads.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(attachUser);

app.use('/uploads', express.static(path.resolve('apps/api/uploads')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/events', eventsRouter);
app.use('/events', documentsRouter);
app.use('/approvals', approvalsRouter);
app.use('/leads', leadsRouter);
app.use('/integrations', integrationsRouter);

app.use(errorHandler);
