export function computeRequestExpiry(by: string | undefined): string {
  const base = by ? new Date(by) : new Date();
  const days = by ? 14 : 30;
  const expiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return expiry.toISOString().slice(0, 10);
}

export function isExpired(expiresIso: string | undefined): boolean {
  if (!expiresIso) return false;
  return new Date(expiresIso).getTime() < Date.now();
}
