import { useCallback, useState } from 'react';

const STORAGE_KEY = 'pinkdrop_recent_searches';

function readRecentSearches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

export function useRecentSearches(maxItems = 5) {
  const [recentQueries, setRecentQueries] = useState<string[]>(readRecentSearches);

  const addRecentQuery = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;

      setRecentQueries((current) => {
        const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, maxItems);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [maxItems]
  );

  const clearRecentQueries = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentQueries([]);
  }, []);

  return {
    recentQueries,
    addRecentQuery,
    clearRecentQueries,
  };
}
