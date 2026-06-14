export function normalizeAccountEmail(email?: string | null) {
  return String(email ?? '').trim().toLowerCase();
}

export function accountEmailsMatch(a?: string | null, b?: string | null) {
  const left = normalizeAccountEmail(a);
  const right = normalizeAccountEmail(b);
  return Boolean(left && right && left === right);
}

export function getAccountFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get('account')?.trim() || '';
}

export function buildSignInPath(accountEmail: string, returnTo?: string) {
  const params = new URLSearchParams({ signin: '1' });
  if (accountEmail) params.set('account', accountEmail);
  if (returnTo) params.set('returnTo', returnTo);
  return `/profile?${params.toString()}`;
}
