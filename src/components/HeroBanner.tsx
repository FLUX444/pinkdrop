import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChromeStar } from './ChromeStar';
import { DeliveryTimer } from './DeliveryTimer';
import type { HeroConfig, Product } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { getProductPath } from '../utils/productUrl';

interface HeroBannerProps {
  config: HeroConfig;
  featuredProduct: Product | null;
}

function splitTitleMain(titleMain: string) {
  const trimmed = titleMain.trim();
  if (trimmed.length <= 1) {
    return { prefix: trimmed, accentLetter: '' };
  }
  return {
    prefix: trimmed.slice(0, -1),
    accentLetter: trimmed.slice(-1),
  };
}

function renderTitleAccent(text: string) {
  return text.split(/(\d+)/).map((part, index) =>
    /^\d+$/.test(part) ? (
      <span key={`${part}-${index}`} className="hero__title-number">
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

export function HeroBanner({ config, featuredProduct }: HeroBannerProps) {
  const [titleSwapped, setTitleSwapped] = useState(false);
  const { prefix, accentLetter } = splitTitleMain(config.titleMain);
  const priceLabel = featuredProduct
    ? `${config.productLabel} // ${formatPrice(featuredProduct.price)}`
    : config.productLabel;

  return (
    <section id="new" className="hero">
      <div className="hero__grid-bg" aria-hidden />
      <ChromeStar size={56} className="hero__star hero__star--1" />
      <ChromeStar size={36} className="hero__star hero__star--2" />
      <ChromeStar size={28} className="hero__star hero__star--3" />
      <div className="hero__content">
        <div className="hero__headline">
          <div className="hero__tag mono">
            <span className="title-code hero__tag-code">&lt;/&gt;</span>
            <span>{config.tag}</span>
          </div>
          <h1
            className={`hero__title${titleSwapped ? ' hero__title--swapped' : ''}`}
            onClick={() => setTitleSwapped((value) => !value)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setTitleSwapped((value) => !value);
              }
            }}
            aria-pressed={titleSwapped}
          >
            <span className="hero__title-main">
              {prefix}
              {accentLetter && (
                <span className="hero__title-a">
                  {accentLetter}
                  <span className="hero__hover-star" aria-hidden />
                </span>
              )}
            </span>
            <span className="hero__title-accent">{renderTitleAccent(config.titleAccent)}</span>
          </h1>
        </div>
        <p className="hero__subtitle">
          {config.subtitle.includes(config.bonusText) ? (
            <>
              {config.subtitle.split(config.bonusText)[0]}
              <span className="hero__bonus">{config.bonusText}</span>
              {config.subtitle.split(config.bonusText)[1]}
            </>
          ) : (
            config.subtitle
          )}
        </p>
        <div className="hero__cta-block">
          <div className="hero__actions">
            <Link to="/catalog" className="btn btn--primary">{config.ctaPrimary}</Link>
            <Link to="/catalog" className="btn btn--secondary">{config.ctaSecondary}</Link>
          </div>
          <DeliveryTimer variant="hero" />
        </div>
        <div className="hero__barcode mono" aria-hidden>
          ||| || ||| | || |||| | |||
        </div>
      </div>

      <div className="hero__product" aria-label={`Новинка: ${config.productTitle}`}>
        {featuredProduct ? (
          <Link
            to={getProductPath(featuredProduct)}
            className="hero__product-card"
            aria-label={`Открыть товар: ${featuredProduct.name}`}
          >
            <span className="hero__spotlight hero__spotlight--left" aria-hidden />
            <span className="hero__spotlight hero__spotlight--right" aria-hidden />
            <span className="hero__product-shadow" aria-hidden />
            <img src={config.heroImageUrl} alt={config.productTitle} />
            <div className="hero__product-info">
              <span className="mono">{priceLabel}</span>
              <strong>{config.productTitle}</strong>
              <small>{config.productNote}</small>
            </div>
          </Link>
        ) : (
          <div className="hero__product-card is-disabled" aria-label={`Товар не привязан: ${config.productTitle}`}>
            <span className="hero__spotlight hero__spotlight--left" aria-hidden />
            <span className="hero__spotlight hero__spotlight--right" aria-hidden />
            <span className="hero__product-shadow" aria-hidden />
            <img src={config.heroImageUrl} alt={config.productTitle} />
            <div className="hero__product-info">
              <span className="mono">{priceLabel}</span>
              <strong>{config.productTitle}</strong>
              <small>{config.productNote}</small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
