import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LegalPageView } from '../components/LegalPageView';
import type { LegalPageContent } from '../types';

interface LegalDocumentPageProps {
  slug: 'privacy' | 'terms';
}

export function LegalDocumentPage({ slug }: LegalDocumentPageProps) {
  const [page, setPage] = useState<LegalPageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .getLegalPage(slug)
      .then((data) => {
        if (cancelled) return;
        setPage(data.page);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Не удалось загрузить документ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="legal-page legal-page--loading">Загрузка...</div>;
  }

  if (error || !page) {
    return <div className="legal-page legal-page--loading">{error || 'Документ не найден'}</div>;
  }

  return <LegalPageView page={page} />;
}
