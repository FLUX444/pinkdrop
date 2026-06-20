import type { CSSProperties } from 'react';

/** Всегда грузим крупный файл — браузер сам уменьшит. Иначе на ПК (DPR 1) брался 58px и выглядел пиксельно. */
const HEADER_LOGO_SRC = '/images/brand-logo-232.png';
const MOBILE_LOGO_SRC = '/images/brand-logo-174.png';

interface BrandLogoProps {
  className?: string;
  size?: number;
}

/** Тот же PD-логотип, что и во вкладке браузера (favicon), в нужном размере для шапки. */
export function BrandLogo({ className = '', size = 58 }: BrandLogoProps) {
  const src = size >= 58 ? HEADER_LOGO_SRC : MOBILE_LOGO_SRC;

  return (
    <img
      src={src}
      alt="PinkDrop"
      className={`brand-logo${className ? ` ${className}` : ''}`}
      style={{ '--brand-logo-size': `${size}px` } as CSSProperties}
      width={size}
      height={size}
      decoding="async"
    />
  );
}
