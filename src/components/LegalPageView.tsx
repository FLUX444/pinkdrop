import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { LegalPageContent } from '../types';

interface LegalPageViewProps {
  page: LegalPageContent;
  showBackLink?: boolean;
}

export function LegalPageView({ page, showBackLink = true }: LegalPageViewProps) {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        {showBackLink && (
          <Link to="/" className="legal-page__back">
            <ArrowLeft size={18} />
            На главную
          </Link>
        )}
        <div className="legal-page__intro">
          <span className="mono legal-page__tag">{page.tag}</span>
          <h1>{page.title}</h1>
          <p>{page.subtitle}</p>
        </div>
      </header>

      <article
        className="legal-page__content"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
    </div>
  );
}
