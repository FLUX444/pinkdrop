import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface SmartBackLinkProps {
  fallback?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}

export function SmartBackLink({
  fallback = '/',
  className,
  children,
  ariaLabel = 'Назад',
}: SmartBackLinkProps) {
  const navigate = useNavigate();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    const historyIdx = window.history.state?.idx ?? 0;
    if (historyIdx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  };

  return (
    <a href={fallback} className={className} aria-label={ariaLabel} onClick={handleClick}>
      {children}
    </a>
  );
}
