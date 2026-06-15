import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, MapPin, Sparkles, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../api/client';
import { DEFAULT_ABOUT } from '../data/about';
import type { AboutConfig } from '../types';

const highlights = [
  {
    icon: Truck,
    title: 'Доставка за 3 часа',
    text: 'По Красноярску и ближайшему пригороду — быстро, без ожидания.',
  },
  {
    icon: Clock3,
    title: 'Живые дропы цен',
    text: 'Скидки падают в реальном времени — успей забрать выгоднее.',
  },
  {
    icon: MapPin,
    title: 'Локальный магазин',
    text: 'Работаем в Красноярске, знаем город и доставляем сами.',
  },
  {
    icon: Sparkles,
    title: 'Красота в деталях',
    text: 'Украшения, аксессуары и бьюти — подобрано с вниманием к стилю.',
  },
] as const;

function renderParagraphs(text: string, skipTeamHeading = false) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const filtered =
    skipTeamHeading && paragraphs[0] && /^наша команда/i.test(paragraphs[0])
      ? paragraphs.slice(1)
      : paragraphs;

  return filtered.map((paragraph) => <p key={paragraph.slice(0, 48)}>{paragraph}</p>);
}

function AboutSideCards({ items }: { items: Array<{ icon: LucideIcon; title: string; text: string }> }) {
  return (
    <div className="about-section__side">
      {items.map((item) => (
        <article key={item.title} className="about-card">
          <span className="about-card__icon" aria-hidden>
            <item.icon size={26} />
          </span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </article>
      ))}
    </div>
  );
}

export function AboutSection() {
  const [about, setAbout] = useState<AboutConfig>(DEFAULT_ABOUT);

  useEffect(() => {
    api.getAbout().then(setAbout).catch(() => setAbout(DEFAULT_ABOUT));
  }, []);

  const introCards = highlights.slice(0, 2);
  const teamCards = highlights.slice(2, 4);

  return (
    <section className="about-section" aria-label="О компании PINKDROP">
      <div className="about-section__glow" aria-hidden />
      <div className="about-section__inner">
        <div className="about-section__stack">
          <div className="about-section__row">
            <div className="about-section__block">
              <span className="mono about-section__tag">ABOUT_PINKDROP</span>
              <h2>Магазин, который успевает за тобой</h2>
              <div className="about-section__text">{renderParagraphs(about.aboutPinkdrop)}</div>
              <Link to="/catalog" className="btn btn--primary about-section__cta">
                Смотреть каталог
              </Link>
            </div>
            <AboutSideCards items={introCards} />
          </div>

          <div className="about-section__row about-section__row--team">
            <AboutSideCards items={teamCards} />
            <div className="about-section__block about-section__block--team">
              <span className="mono about-section__tag">ABOUT_PINKDROP_TEAM</span>
              <h2>О нашей команде</h2>
              <div className="about-section__text">
                {renderParagraphs(about.aboutPinkdropTeam, true)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
