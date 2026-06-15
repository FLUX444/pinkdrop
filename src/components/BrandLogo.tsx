interface BrandLogoProps {
  className?: string;
  size?: number;
}

export function BrandLogo({ className = '', size = 52 }: BrandLogoProps) {
  return (
    <img
      src="/images/pinkdrop-pd-logo.png"
      alt="PinkDrop"
      className={`brand-logo${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      decoding="async"
    />
  );
}
