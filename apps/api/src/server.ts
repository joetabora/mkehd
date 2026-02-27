import { app } from './app.js';
import { config } from './lib/config.js';
import { startSyncJobWorker } from './lib/jobs/worker.js';

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

startSyncJobWorker();
