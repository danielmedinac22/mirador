export class MiradorError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint?: string,
  ) {
    super(message);
    this.name = 'MiradorError';
  }
}

export const ERRORS = {
  PREFLIGHT_GH_AUTH: 'PREFLIGHT_GH_AUTH',
  PREFLIGHT_VERCEL_AUTH: 'PREFLIGHT_VERCEL_AUTH',
  PREFLIGHT_GIT: 'PREFLIGHT_GIT',
  PREFLIGHT_NODE_VERSION: 'PREFLIGHT_NODE_VERSION',
  WORKSPACE_EXISTS: 'WORKSPACE_EXISTS',
  GITHUB_API: 'GITHUB_API',
  VERCEL_DEPLOY: 'VERCEL_DEPLOY',
} as const;

export type ErrorCode = (typeof ERRORS)[keyof typeof ERRORS];
