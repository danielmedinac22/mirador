import * as vercel from '../adapters/vercel.js';

export async function ensureUserProject(
  handle: string,
): Promise<{ projectName: string; domain: string }> {
  const name = `mirador-${handle}`;
  const project = await vercel.ensureProject(name);
  return {
    projectName: project.projectName,
    domain: `${project.projectName}.vercel.app`,
  };
}
