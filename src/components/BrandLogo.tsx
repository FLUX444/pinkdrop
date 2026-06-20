import type { CSSProperties } from 'react';

/** Тот же файл, что favicon во вкладке — nginx отдаёт из /var/www/pinkdrop после deploy. */
const LOGO_VERSION = '11';
const HEADER_LOGO_SRC = `/favicon-512.png?v=${LOGO_VERSION}`;
const MOBILE_LOGO_SRC = `/favicon-192.png?v=${LOGO_VERSION}`;

interface BrandLogoProps {
  className?: string;
  size?: number;
}

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
