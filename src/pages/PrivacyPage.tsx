import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <Link to="/" className="legal-page__back">
          <ArrowLeft size={18} />
          На главную
        </Link>
        <div className="legal-page__intro">
          <span className="mono legal-page__tag">PRIVACY_POLICY</span>
          <h1>Политика конфиденциальности</h1>
          <p>Действует с 11 июня 2026 г. · PinkDrop</p>
        </div>
      </header>

      <article className="legal-page__content">
        <section>
          <h2>1. Какие данные мы собираем</h2>
          <p>
            При оформлении заказа и входе в личный кабинет мы можем обрабатывать: имя, email, телефон
            для доставки, адрес доставки, историю заказов, отзывы и медиафайлы к ним, а также данные
            авторизации через Google, ВКонтакте или Telegram.
          </p>
        </section>

        <section>
          <h2>2. Зачем это нужно</h2>
          <ul>
            <li>оформление и доставка заказов;</li>
            <li>авторизация в личном кабинете;</li>
            <li>связь по статусу заказа и поддержке;</li>
            <li>публикация отзывов после покупки;</li>
            <li>улучшение сервиса и защита от злоупотреблений.</li>
          </ul>
        </section>

        <section>
          <h2>3. Хранение и защита</h2>
          <p>
            Адреса доставки хранятся в зашифрованном виде. Доступ к данным есть только у
            авторизованных серверных процессов PinkDrop. Мы не продаём персональные данные третьим
            лицам.
          </p>
        </section>

        <section>
          <h2>4. Cookies и сессии</h2>
          <p>
            Сайт использует cookies для входа в аккаунт, корзины и админ-панели. Без них часть
            функций работать не будет.
          </p>
        </section>

        <section>
          <h2>5. Ваши права</h2>
          <p>
            Вы можете запросить исправление или удаление данных, отозвать согласие на сохранение
            адреса в профиле и прекратить использование сервиса. Для запросов напишите в поддержку
            через контакты на сайте.
          </p>
        </section>

        <section>
          <h2>6. Контакты</h2>
          <p>
            По вопросам персональных данных: <a href="mailto:privacy@pinkdrop.shop">privacy@pinkdrop.shop</a>
          </p>
        </section>
      </article>
    </div>
  );
}
