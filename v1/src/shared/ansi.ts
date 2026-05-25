/* Tiny ANSI helpers for the CLI. No new deps.
   Uses 24-bit truecolor for the cobalt — modern terminals (Terminal.app on
   macOS 11+, iTerm2, WezTerm, Alacritty, kitty) all support it. */

const TTY = process.stdout.isTTY && !process.env.NO_COLOR;

const wrap =
  (open: string, close = '\x1b[0m') =>
  (s: string): string =>
    TTY ? `${open}${s}${close}` : s;

export const dim = wrap('\x1b[2m');
export const bold = wrap('\x1b[1m');
export const cobalt = wrap('\x1b[38;2;79;125;243m'); // #4F7DF3 — cobalt-bright
export const cobaltDeep = wrap('\x1b[38;2;37;65;178m'); // #2541B2 — cobalt
export const muted = wrap('\x1b[38;5;245m');
export const success = wrap('\x1b[38;5;36m'); // teal-green
export const warn = wrap('\x1b[38;5;179m');

/**
 * The aperture splash — ASCII rendition of the mark. Prints to stdout with
 * a single trailing newline. Skips on non-TTY.
 */
export function printSplash(): void {
  if (!TTY) return;
  const lines = [
    '',
    dim('  ┌──┐'),
    `  ${dim('│')} ${cobalt('▪')}${dim('│')}  ${bold('mirador.')}`,
    dim('  └──┘'),
    '',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}
