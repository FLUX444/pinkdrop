import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useCredentialsEntry() {
  const [searchParams] = useSearchParams();
  const entry = searchParams.get('entry')?.trim() || '';
  const [redirecting, setRedirecting] = useState(Boolean(entry));

  useEffect(() => {
    if (!entry) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('entry');
    const query = nextParams.toString();
    const nextPath = `${window.location.pathname}${query ? `?${query}` : ''}` || '/profile';

    const params = new URLSearchParams();
    params.set('token', entry);
    params.set('next', nextPath);
    window.location.replace(`/api/auth/credentials-entry?${params.toString()}`);
    setRedirecting(true);
  }, [entry, searchParams]);

  return {
    ready: !entry,
    error: '',
    isEntering: redirecting,
    hasEntry: Boolean(entry),
  };
}
