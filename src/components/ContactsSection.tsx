import { Y2KIcon } from './Y2KIcon';

export function ContactsSection() {
  return (
    <section id="contacts" className="contacts-section">
      <div className="contacts-section__inner">
        <h2 className="contacts-section__title title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>КОНТАКТЫ</span>
        </h2>
        <div className="contacts-grid">
          <div className="contact-card">
            <Y2KIcon name="phone" size={28} className="contact-card__icon" />
            <h3>Телефон</h3>
            <a href="tel:+73912223344">+7 (391) 222-33-44</a>
          </div>
          <div className="contact-card">
            <Y2KIcon name="telegram" size={28} className="contact-card__icon" />
            <h3>Telegram</h3>
            <a href="https://t.me/krasnoyarsk_shop_bot" target="_blank" rel="noopener noreferrer">
              @krasnoyarsk_shop_bot
            </a>
          </div>
          <div className="contact-card">
            <Y2KIcon name="location" size={28} className="contact-card__icon" />
            <h3>Зона доставки</h3>
            <p>Красноярск и пригород<br />до 25 км от центра</p>
          </div>
          <div className="contact-card">
            <Y2KIcon name="clock" size={28} className="contact-card__icon" />
            <h3>График</h3>
            <p>Ежедневно 10:00 — 21:00<br />Приём заказов до 18:00</p>
          </div>
        </div>
        <div className="contacts-section__barcode mono" aria-hidden>
          PINKDROP // DELIVERY_3H // 2026
        </div>
      </div>
    </section>
  );
}
