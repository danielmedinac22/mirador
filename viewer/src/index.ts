import { createViewerServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATA_DIR ?? './data';
const publicBaseUrl = process.env.PUBLIC_BASE_URL;

const server = createViewerServer({ dataDir, publicBaseUrl });
server.listen(port, () => {
  console.log(`mirador-viewer listening on :${port} (data: ${dataDir})`);
});
