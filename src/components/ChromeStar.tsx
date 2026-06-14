import type { CSSProperties } from 'react';

interface ChromeStarProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function ChromeStar({ size = 48, className = '', style }: ChromeStarProps) {
  return (
    <svg
      className={`chrome-star ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#c0c0c0" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="75%" stopColor="#808080" />
          <stop offset="100%" stopColor="#e8e8e8" />
        </linearGradient>
        <filter id="chromeGlow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4" />
        </filter>
      </defs>
      <polygon
        points="50,0 58,38 100,50 58,62 50,100 42,62 0,50 42,38"
        fill="url(#chromeGrad)"
        filter="url(#chromeGlow)"
      />
      <polygon
        points="50,8 54,36 88,50 54,64 50,92 46,64 12,50 46,36"
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1"
      />
    </svg>
  );
}
