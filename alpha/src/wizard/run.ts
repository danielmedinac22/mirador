export interface RunOptions {
  mode: 'init' | 'config';
}

export async function runInit(_opts: RunOptions): Promise<void> {
  throw new Error('wizard not implemented yet');
}
