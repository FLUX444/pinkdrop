import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DEFAULT_CONTACTS } from '../data/contacts';
import type { ContactsConfig } from '../types';
import { PhoneContactModal } from './PhoneContactModal';
import { Y2KIcon } from './Y2KIcon';

function isMobilePhoneDevice() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 819px), (hover: none) and (pointer: coarse)').matches;
}

export function ContactsSection() {
  const [contacts, setContacts] = useState<ContactsConfig>(DEFAULT_CONTACTS);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);

  useEffect(() => {
    api.getContacts().then(setContacts).catch(() => setContacts(DEFAULT_CONTACTS));
  }, []);

  const handlePhoneClick = () => {
    if (isMobilePhoneDevice()) {
      window.location.href = `tel:${contacts.phoneHref}`;
      return;
    }
    setPhoneModalOpen(true);
  };

  const openTelegram = () => {
    window.open(contacts.telegramUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="contacts" className="contacts-section">
      <div className="contacts-section__inner">
        <h2 className="contacts-section__title title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>КОНТАКТЫ</span>
        </h2>
        <div className="contacts-grid">
          <button type="button" className="contact-card contact-card--action" onClick={handlePhoneClick}>
            <span className="contact-card__icon-wrap" aria-hidden>
              <Y2KIcon name="phone" size={24} className="contact-card__icon" />
            </span>
            <h3>Телефон</h3>
            <span className="contact-card__value">{contacts.phoneDisplay}</span>
          </button>

          <button type="button" className="contact-card contact-card--action" onClick={openTelegram}>
            <span className="contact-card__icon-wrap" aria-hidden>
              <Y2KIcon name="telegram" size={24} className="contact-card__icon" />
            </span>
            <h3>Telegram</h3>
            <span className="contact-card__value">@{contacts.telegramUsername.replace(/^@/, '')}</span>
          </button>

          <div className="contact-card">
            <span className="contact-card__icon-wrap" aria-hidden>
              <Y2KIcon name="location" size={24} className="contact-card__icon" />
            </span>
            <h3>Зона доставки</h3>
            <p>{contacts.deliveryZone}</p>
          </div>

          <div className="contact-card">
            <span className="contact-card__icon-wrap" aria-hidden>
              <Y2KIcon name="clock" size={24} className="contact-card__icon" />
            </span>
            <h3>График</h3>
            <p>
              {contacts.scheduleLine1}
              <br />
              {contacts.scheduleLine2}
            </p>
          </div>
        </div>
        <div className="contacts-section__barcode mono" aria-hidden>
          PINKDROP // DELIVERY_3H // 2026
        </div>
      </div>

      {phoneModalOpen && (
        <PhoneContactModal
          phoneDisplay={contacts.phoneDisplay}
          phoneHref={contacts.phoneHref}
          onClose={() => setPhoneModalOpen(false)}
        />
      )}
    </section>
  );
}
