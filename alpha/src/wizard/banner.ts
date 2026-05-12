import { VERSION } from '../version.js';

const BANNER = String.raw`
███╗   ███╗██╗██████╗  █████╗ ██████╗  ██████╗ ██████╗
████╗ ████║██║██╔══██╗██╔══██╗██╔══██╗██╔═══██╗██╔══██╗
██╔████╔██║██║██████╔╝███████║██║  ██║██║   ██║██████╔╝
██║╚██╔╝██║██║██╔══██╗██╔══██║██║  ██║██║   ██║██╔══██╗
██║ ╚═╝ ██║██║██║  ██║██║  ██║██████╔╝╚██████╔╝██║  ██║
╚═╝     ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝`;

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
};

export function printBanner(): void {
  console.log(`${C.cyan}${BANNER}${C.reset}`);
  console.log(`  ${C.dim}v${VERSION}${C.reset}   Publish AI-generated HTML to your own Vercel.\n`);
}
