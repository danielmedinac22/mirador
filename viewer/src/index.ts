import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createViewerServer } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const dataDir = process.env.DATA_DIR ?? './data';
const publicBaseUrl = process.env.PUBLIC_BASE_URL;

const bundledStatic = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
const assetsDir = process.env.ASSETS_DIR ?? (existsSync(bundledStatic) ? bundledStatic : undefined);

const server = createViewerServer({ dataDir, publicBaseUrl, assetsDir });
server.listen(port, () => {
  console.log(`mirador-viewer listening on :${port} (data: ${dataDir})`);
});
