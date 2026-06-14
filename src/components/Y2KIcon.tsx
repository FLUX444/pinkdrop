type Y2KIconName =
  | 'accessory'
  | 'box'
  | 'card'
  | 'cash'
  | 'clock'
  | 'delivery'
  | 'fire'
  | 'gift'
  | 'heart'
  | 'location'
  | 'phone'
  | 'return'
  | 'ring'
  | 'telegram'
  | 'timer';

interface Y2KIconProps {
  name: Y2KIconName;
  size?: number;
  className?: string;
}

export function Y2KIcon({ name, size = 18, className }: Y2KIconProps) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className: `y2k-icon ${className ?? ''}`.trim(),
    'aria-hidden': true,
  };

  return (
    <svg {...commonProps}>
      <defs>
        <linearGradient id={`y2k-icon-gradient-${name}`} x1="2" y1="2" x2="22" y2="22">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.48" stopColor="#ff2d95" />
          <stop offset="1" stopColor="#8d2cff" />
        </linearGradient>
      </defs>
      {renderIcon(name, `url(#y2k-icon-gradient-${name})`)}
    </svg>
  );
}

function renderIcon(name: Y2KIconName, gradient: string) {
  switch (name) {
    case 'ring':
      return (
        <>
          <path d="M9 8.4 12 4l3 4.4-3 2.4-3-2.4Z" fill={gradient} />
          <path d="M7.4 14.6a4.6 4.6 0 1 0 9.2 0 4.6 4.6 0 0 0-9.2 0Z" fill="none" stroke={gradient} strokeWidth="2.2" />
          <path d="M5 5.2h2.2M16.8 5.2H19M12 1.8V4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case 'accessory':
      return (
        <>
          <path d="M6.8 9.4c0-2.8 2.1-5 5.2-5s5.2 2.2 5.2 5v6.8c0 1.8-1.2 3-3 3H9.8c-1.8 0-3-1.2-3-3V9.4Z" fill="none" stroke={gradient} strokeWidth="2.1" />
          <path d="M9 9.2c0-1.7 1.1-2.9 3-2.9s3 1.2 3 2.9" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M6.2 15.2 4.3 17m13.5-1.8 1.9 1.8" stroke={gradient} strokeWidth="1.7" strokeLinecap="round" />
        </>
      );
    case 'fire':
      return (
        <>
          <path d="M12.8 21c4.3-.8 6.5-3.5 6.1-7.3-.3-2.6-2-4.7-4.9-7.1.2 2-.4 3.4-1.9 4.4.2-3-1.5-5.2-4.3-7.5.3 3.2-.7 5.1-2 7.1-2.2 3.5-.9 8.5 3.8 10.1" fill={gradient} />
          <path d="M12.1 20.9c2.2-.9 3.3-2.5 3.1-4.3-.1-1.3-.8-2.3-2.1-3.4-.1 1.2-.7 2.1-1.8 2.8.1-1.7-.8-2.9-2.2-4.1.1 2-.7 3.1-1.1 4.1-.8 2 .5 4.2 2.8 4.9" fill="#0a0a0a" opacity="0.88" />
        </>
      );
    case 'delivery':
      return (
        <>
          <path d="M12.8 2.8c3.1 1.2 5 4.1 4.7 7.7l3 2.2-3.7 1-2.7 4.7-1.2-3.4-3.7 2 .9-4.1-3.5-1.3 4.2-2.5c.3-2.9 1.4-5 2-6.3Z" fill={gradient} />
          <path d="M13.5 8.2a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 0 0-3.2 0Z" fill="#0a0a0a" />
          <path d="M7.6 17.5 4.2 21m5.6-2.2-1.4 2.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        </>
      );
    case 'timer':
      return (
        <>
          <path d="M9 3h6M12 3v3M17.6 7.1l1.6-1.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="13.4" r="6.8" fill="none" stroke={gradient} strokeWidth="2.2" />
          <path d="M12 9.8v4l3 1.8" stroke={gradient} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'phone':
      return (
        <path d="M7.2 4.2 10 3.3l2 4-1.7 1.5c.9 1.9 2.4 3.4 4.4 4.5l1.6-1.7 4 2-.9 2.9c-.4 1.3-1.6 2.1-3 1.8C10 17.1 5.8 12.9 4.7 6.6c-.2-1.3.5-2.3 2.5-2.4Z" fill={gradient} />
      );
    case 'telegram':
      return (
        <>
          <path d="M21 4.4 17.9 20c-.2 1.1-1 1.3-1.8.8l-4.3-3.2-2.1 2c-.3.3-.6.5-1.1.5l.4-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L6.4 14.2 2 12.8c-1-.3-1-.9.2-1.4L19.5 4c.9-.3 1.7.2 1.5.4Z" fill={gradient} />
          <path d="m9 15.5 8.4-7.6" stroke="#0a0a0a" strokeWidth="1.4" strokeLinecap="round" />
        </>
      );
    case 'location':
      return (
        <>
          <path d="M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" fill={gradient} />
          <circle cx="12" cy="10" r="2.2" fill="#0a0a0a" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8" fill="none" stroke={gradient} strokeWidth="2.2" />
          <path d="M12 7.8V12l3.2 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 3.8 3.8 6m14.2-2.2L20.2 6" stroke={gradient} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case 'cash':
      return (
        <>
          <rect x="3.2" y="6.4" width="17.6" height="11.2" rx="2" fill="none" stroke={gradient} strokeWidth="2" />
          <circle cx="12" cy="12" r="2.6" fill={gradient} />
          <path d="M6.5 9.1h1.8m7.4 5.8h1.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case 'card':
      return (
        <>
          <rect x="3.2" y="5.8" width="17.6" height="12.4" rx="2.2" fill="none" stroke={gradient} strokeWidth="2" />
          <path d="M4.2 9.2h15.6" stroke={gradient} strokeWidth="2" />
          <path d="M7 14.4h4.2m2.2 0h2.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
        </>
      );
    case 'gift':
      return (
        <>
          <path d="M4 10h16v10H4V10Z" fill="none" stroke={gradient} strokeWidth="2" />
          <path d="M3.5 7h17v3h-17V7ZM12 7v13" stroke={gradient} strokeWidth="2" />
          <path d="M12 7c-2.7 0-4.4-1-4.4-2.4 0-1 .8-1.6 1.8-1.6C10.8 3 11.7 4.7 12 7Zm0 0c2.7 0 4.4-1 4.4-2.4 0-1-.8-1.6-1.8-1.6C13.2 3 12.3 4.7 12 7Z" fill={gradient} />
        </>
      );
    case 'return':
      return (
        <>
          <path d="M8.6 6.2 4.8 10l3.8 3.8" fill="none" stroke={gradient} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.2 10h9.2a4.8 4.8 0 1 1 0 9.6H11" fill="none" stroke={gradient} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case 'heart':
      return (
        <path d="M12 20.5S4.5 16.1 3.4 10.4C2.7 6.9 4.8 4.2 8 4.2c1.8 0 3.1.9 4 2.2.9-1.3 2.2-2.2 4-2.2 3.2 0 5.3 2.7 4.6 6.2C19.5 16.1 12 20.5 12 20.5Z" fill={gradient} />
      );
    case 'box':
      return (
        <>
          <path d="m12 2.8 8 4.1v10.2l-8 4.1-8-4.1V6.9l8-4.1Z" fill="none" stroke={gradient} strokeWidth="2" strokeLinejoin="round" />
          <path d="M4.8 7.2 12 11l7.2-3.8M12 11v9.5" stroke={gradient} strokeWidth="2" strokeLinejoin="round" />
        </>
      );
  }
}
