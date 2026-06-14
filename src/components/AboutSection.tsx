import { Link } from 'react-router-dom';
import { Clock3, MapPin, Sparkles, Truck } from 'lucide-react';

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

export function AboutSection() {
  return (
    <section className="about-section" aria-label="О компании PINKDROP">
      <div className="about-section__glow" aria-hidden />
      <div className="about-section__inner">
        <div className="about-section__intro">
          <span className="mono about-section__tag">ABOUT_PINKDROP</span>
          <h2>Магазин, который успевает за тобой</h2>
          <p>
            PINKDROP — это онлайн-витрина с доставкой за три часа. Мы собираем трендовые украшения,
            аксессуары и бьюти-товары, чтобы ты могла заказать сейчас и получить сегодня — без
            долгого ожидания и лишней суеты.
          </p>
          <p>
            Оплата при получении, бонус если опоздали, возврат в течение 7 дней — всё прозрачно и
            по-человечески. Каталог обновляется регулярно: смотри новинки, лови дропы цен и
            добавляй в корзину то, что нравится.
          </p>
          <Link to="/catalog" className="btn btn--primary about-section__cta">
            Смотреть каталог
          </Link>
        </div>

        <div className="about-section__grid">
          {highlights.map((item) => (
            <article key={item.title} className="about-card">
              <span className="about-card__icon" aria-hidden>
                <item.icon size={22} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
