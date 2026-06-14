import type { Product } from '../types';
import { getProductDisplayLabels } from '../utils/productDisplayTitle';

interface ProductArtworkProps {
  product: Product;
  compact?: boolean;
  showProduct?: boolean;
  imageSrc?: string;
}

type IllustrationVariant =
  | 'fridge'
  | 'thermoBag'
  | 'tent'
  | 'sleepingBag'
  | 'powerbank'
  | 'cookware'
  | 'flashlight'
  | 'iceMaker'
  | 'stickers'
  | 'keyring'
  | 'secretBox'
  | 'photo';

const seedIllustrations: Record<string, IllustrationVariant> = {
  '1': 'fridge',
  '2': 'thermoBag',
  '3': 'tent',
  '4': 'sleepingBag',
  '5': 'powerbank',
  '6': 'cookware',
  '7': 'flashlight',
  '8': 'iceMaker',
  '9': 'stickers',
  '10': 'keyring',
  '11': 'secretBox',
  '12': 'secretBox',
};

function resolveArtworkChip(product: Product, typeLabel: string) {
  if (product.isSecret) return 'LOCKED';
  if (product.isFree) return 'FREE';
  return typeLabel;
}

function resolveProductImage(product: Product, imageSrc?: string) {
  const candidate = imageSrc ?? product.images[0];
  return candidate?.startsWith('/') ? candidate : undefined;
}

const productCutouts: Record<string, string> = {
  '1': '/images/products/cutout-01-fridge.png',
  '2': '/images/products/cutout-02-thermo-bag.png',
  '3': '/images/products/cutout-03-tent.png',
  '4': '/images/products/cutout-04-sleeping-bag.png',
  '5': '/images/products/cutout-05-powerbank.png',
  '6': '/images/products/cutout-06-cookware.png',
  '7': '/images/products/cutout-07-flashlight.png',
  '8': '/images/products/cutout-08-ice-maker.png',
  '11': '/images/products/cutout-11-secret-night.png',
  '12': '/images/products/cutout-12-secret-siberia.png',
};

function ProductIllustration({ variant }: { variant: IllustrationVariant }) {
  const common = {
    className: 'product-art__illustration',
    viewBox: '0 0 240 180',
    role: 'img' as const,
    'aria-hidden': true,
  };

  if (variant === 'fridge') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M64 151h101l18 13H48l16-13Z" />
        <rect className="pa-chrome" x="72" y="26" width="92" height="128" rx="14" />
        <path className="pa-dark" d="M84 40h68v50H84zM84 99h68v41H84z" />
        <path className="pa-pink" d="M159 55h9v72h-9z" />
        <path className="pa-line" d="M84 93h68M104 120h28" />
        <text className="pa-label" x="92" y="70">-18°C</text>
      </svg>
    );
  }

  if (variant === 'thermoBag') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M55 148h125l13 14H42l13-14Z" />
        <path className="pa-chrome" d="M60 68h119l-13 84H73L60 68Z" />
        <path className="pa-dark" d="M72 80h94l-8 58H80l-8-58Z" />
        <path className="pa-pink" d="M82 58c7-24 65-25 74 0" />
        <path className="pa-line" d="M89 100h58M98 118h40" />
        <text className="pa-label" x="92" y="134">25L</text>
      </svg>
    );
  }

  if (variant === 'tent') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M50 148h139l19 14H31l19-14Z" />
        <path className="pa-chrome" d="M119 29 198 151H42L119 29Z" />
        <path className="pa-dark" d="M119 51 164 151H75L119 51Z" />
        <path className="pa-pink" d="M119 51v100M76 151l43-100 45 100" />
        <path className="pa-line" d="M42 151h156M119 29l-9 122" />
      </svg>
    );
  }

  if (variant === 'sleepingBag') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M66 148h105l17 14H48l18-14Z" />
        <rect className="pa-chrome" x="76" y="31" width="87" height="121" rx="43" />
        <path className="pa-dark" d="M94 48h51v87c-9 10-40 11-51 0V48Z" />
        <path className="pa-pink" d="M119 49v92M96 75h47M94 105h51" />
        <text className="pa-label" x="94" y="128">-15°</text>
      </svg>
    );
  }

  if (variant === 'powerbank') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M70 150h100l18 13H52l18-13Z" />
        <rect className="pa-chrome" x="78" y="28" width="84" height="125" rx="18" />
        <rect className="pa-dark" x="94" y="43" width="52" height="78" rx="10" />
        <path className="pa-pink pa-fill" d="m116 62-16 31h19l-12 31 32-44h-20l10-18h-13Z" />
        <path className="pa-line" d="M105 139h29" />
        <text className="pa-label" x="90" y="57">20000</text>
      </svg>
    );
  }

  if (variant === 'cookware') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M52 150h138l17 13H34l18-13Z" />
        <ellipse className="pa-chrome" cx="111" cy="99" rx="58" ry="24" />
        <path className="pa-chrome" d="M58 96h106l-13 50H72L58 96Z" />
        <path className="pa-dark" d="M79 104h61l-6 29H86l-7-29Z" />
        <path className="pa-line" d="M56 95H26M166 95h40M93 69c8-13 47-13 55 0" />
        <circle className="pa-pink" cx="145" cy="73" r="11" />
      </svg>
    );
  }

  if (variant === 'flashlight') {
    return (
      <svg {...common}>
        <path className="pa-light" d="M144 77 226 38v84l-82-31V77Z" />
        <path className="pa-shadow" d="M53 139h111l16 13H37l16-13Z" />
        <path className="pa-chrome" d="M43 79h85l25-23 26 18-22 31H43V79Z" />
        <path className="pa-dark" d="M57 86h78l-7 13H57V86Z" />
        <path className="pa-pink" d="M151 60 176 77M151 101l25-24" />
        <text className="pa-label" x="63" y="76">1200</text>
      </svg>
    );
  }

  if (variant === 'iceMaker') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M60 148h120l16 14H43l17-14Z" />
        <rect className="pa-chrome" x="62" y="34" width="116" height="116" rx="18" />
        <path className="pa-dark" d="M79 52h82v37H79zM80 100h80v33H80z" />
        <rect className="pa-pink" x="91" y="61" width="18" height="18" rx="4" />
        <rect className="pa-pink" x="116" y="61" width="18" height="18" rx="4" />
        <rect className="pa-pink" x="101" y="110" width="38" height="14" rx="7" />
        <text className="pa-label" x="88" y="145">ICE 7 MIN</text>
      </svg>
    );
  }

  if (variant === 'stickers') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M58 149h122l18 13H40l18-13Z" />
        <rect className="pa-chrome" x="57" y="47" width="82" height="82" rx="12" transform="rotate(-10 98 88)" />
        <rect className="pa-dark" x="98" y="38" width="82" height="82" rx="12" transform="rotate(9 139 79)" />
        <path className="pa-pink pa-fill" d="m136 57 11 24 26 3-20 17 6 26-23-14-23 14 6-26-20-17 26-3 11-24Z" />
        <text className="pa-label" x="72" y="104">KRAS</text>
      </svg>
    );
  }

  if (variant === 'keyring') {
    return (
      <svg {...common}>
        <path className="pa-shadow" d="M60 150h116l18 13H43l17-13Z" />
        <circle className="pa-chrome" cx="118" cy="64" r="30" />
        <circle className="pa-dark" cx="118" cy="64" r="16" />
        <path className="pa-line" d="M118 94v24" />
        <path className="pa-pink pa-fill" d="M86 116h65l16 30H70l16-30Z" />
        <text className="pa-label" x="91" y="137">KRSK</text>
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path className="pa-shadow" d="M55 149h130l19 14H36l19-14Z" />
      <path className="pa-chrome" d="M62 65 119 34l59 31v78H62V65Z" />
      <path className="pa-dark" d="M78 75 119 53l42 22v51H78V75Z" />
      <path className="pa-pink" d="M119 53v89M78 75l41 25 42-25" />
      <text className="pa-label" x="91" y="119">SECRET</text>
    </svg>
  );
}

export function ProductArtwork({
  product,
  compact = false,
  showProduct = true,
  imageSrc,
}: ProductArtworkProps) {
  const labels = getProductDisplayLabels(product);
  const isFree = product.isFree;
  const productImage = resolveProductImage(product, imageSrc);
  const cutout = productImage ?? productCutouts[product.id];
  const illustrationVariant = seedIllustrations[product.id] ?? 'photo';
  const classes = [
    'product-art',
    compact ? 'product-art--compact' : '',
    isFree ? 'product-art--free' : '',
    `product-art--${product.id}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="product-art__grid" aria-hidden />
      <div className="product-art__orb" aria-hidden />
      <div className="product-art__corner product-art__corner--tl" aria-hidden />
      <div className="product-art__corner product-art__corner--br" aria-hidden />

      <div className="product-art__top">
        <span className="mono">{labels.code}</span>
        <span className="product-art__chip">{resolveArtworkChip(product, labels.type)}</span>
      </div>

      {showProduct && (
        cutout && !isFree ? (
          <img className="product-art__cutout" src={cutout} alt="" loading="lazy" draggable={false} />
        ) : (
          <ProductIllustration variant={illustrationVariant} />
        )
      )}

      {showProduct && (
        <div className="product-art__text">
          <strong>{labels.title}</strong>
          {labels.accent && <span>{labels.accent}</span>}
        </div>
      )}
      <div className="product-art__footer mono">PINKDROP // PICK TODAY</div>
    </div>
  );
}
