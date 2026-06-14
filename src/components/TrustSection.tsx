import { Y2KIcon } from './Y2KIcon';

const trustItems = [
  {
    icon: 'cash',
    title: 'Оплата при получении',
    text: 'Можно проверить товар перед оплатой курьеру.',
  },
  {
    icon: 'delivery',
    title: 'Доставка за 3 часа',
    text: 'По Красноярску и ближайшему пригороду.',
  },
  {
    icon: 'gift',
    title: 'Бонус 500 ₽',
    text: 'Если не успели в обещанное время.',
  },
  {
    icon: 'return',
    title: 'Возврат 7 дней',
    text: 'Быстро решаем обмен и возврат без лишней бюрократии.',
  },
] as const;

export function TrustSection() {
  return (
    <section className="trust-section" aria-label="Преимущества магазина">
      <div className="trust-section__header">
        <span className="mono">WHY_TRUST_US</span>
        <h2>Покупать спокойно</h2>
      </div>
      <div className="trust-grid">
        {trustItems.map((item) => (
          <article key={item.title} className="trust-card">
            <span className="trust-card__icon">
              <Y2KIcon name={item.icon} size={24} />
            </span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
