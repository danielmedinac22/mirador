import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ArtifactMeta {
  slug: string;
  title: string;
  tokenHash: string;
  createdAt: string;
  updatedAt: string;
}

export type PutResult = 'ok' | 'not_found' | 'unauthorized';

const SLUG_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class FileStore {
  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
  }

  private metaPath(slug: string): string {
    return join(this.dataDir, `${slug}.json`);
  }

  private htmlPath(slug: string): string {
    return join(this.dataDir, `${slug}.html`);
  }

  private writeAtomic(path: string, content: string): void {
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, content, 'utf8');
    renameSync(tmp, path);
  }

  create(title: string): { slug: string; writeToken: string } {
    const slug = randomBytes(12).toString('base64url');
    const writeToken = randomBytes(32).toString('base64url');
    const now = new Date().toISOString();
    const meta: ArtifactMeta = {
      slug,
      title,
      tokenHash: hashToken(writeToken),
      createdAt: now,
      updatedAt: now,
    };
    this.writeAtomic(this.metaPath(slug), JSON.stringify(meta, null, 2));
    return { slug, writeToken };
  }

  getMeta(slug: string): ArtifactMeta | null {
    if (!isValidSlug(slug) || !existsSync(this.metaPath(slug))) return null;
    return JSON.parse(readFileSync(this.metaPath(slug), 'utf8')) as ArtifactMeta;
  }

  put(slug: string, token: string, html: string): PutResult {
    const meta = this.getMeta(slug);
    if (!meta) return 'not_found';
    const expected = Buffer.from(meta.tokenHash, 'hex');
    const actual = Buffer.from(hashToken(token), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return 'unauthorized';
    }
    this.writeAtomic(this.htmlPath(slug), html);
    meta.updatedAt = new Date().toISOString();
    this.writeAtomic(this.metaPath(slug), JSON.stringify(meta, null, 2));
    return 'ok';
  }

  getHtml(slug: string): string | null {
    if (!isValidSlug(slug) || !existsSync(this.htmlPath(slug))) return null;
    return readFileSync(this.htmlPath(slug), 'utf8');
  }
}
