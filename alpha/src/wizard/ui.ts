const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

export const ui = {
  /** Bright cyan inline highlight, e.g. for /mirador. */
  highlight(s: string): string {
    return `${C.bold}${C.cyan}${s}${C.reset}`;
  },
  /** Dim grey for paths and version strings. */
  dim(s: string): string {
    return `${C.dim}${s}${C.reset}`;
  },
  /** Green "Done!" banner-style success word. */
  done(s: string): string {
    return `${C.bold}${C.green}${s}${C.reset}`;
  },
};
