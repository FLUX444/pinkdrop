import type { CSSProperties } from 'react';

/** 58px в шапке, файл 116px — чётко на ПК, без загрузки 512px. */
const LOGO_VERSION = '12';
const HEADER_LOGO_SRC = `/images/brand-logo-116.png?v=${LOGO_VERSION}`;
const MOBILE_LOGO_SRC = `/images/brand-logo-96.png?v=${LOGO_VERSION}`;

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
