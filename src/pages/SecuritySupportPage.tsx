import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

export function SecuritySupportPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Ссылка недействительна. Откройте форму из письма о смене пароля или почты.');
      setLoading(false);
      return;
    }

    api
      .getSecurityIncidentSupport(token)
      .then((payload) => {
        setBody(payload.prefill);
        setEmail(payload.email);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Ссылка недействительна или устарела');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      await api.submitSecurityIncidentSupport({ token, body });
      setSubmitted(true);
      setMessage('Обращение отправлено. Мы свяжемся с вами по почте.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить обращение');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="profile-page change-password-page">
      <div className="profile-page__header">
        <Link to="/" className="profile-page__back" aria-label="На главную">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="title-with-code">
          <span className="title-code">&lt;/&gt;</span>
          <span>ПОДДЕРЖКА</span>
        </h1>
      </div>

      <section className="profile-password profile-password--page">
        <div className="profile-password__head">
          <span className="profile-password__icon" aria-hidden>
            <ShieldAlert size={18} />
          </span>
          <div>
            <span className="mono profile-password__tag">SECURITY_INCIDENT</span>
            <h2>Меня взломали</h2>
          </div>
        </div>

        {loading ? (
          <p className="profile-password__hint mono">LOADING...</p>
        ) : submitted ? (
          <>
            <p className="profile-password__success">{message}</p>
            <Link to="/" className="btn btn--primary">
              На главную
            </Link>
          </>
        ) : (
          <>
            {email && (
              <p className="profile-password__hint">
                Аккаунт: <strong>{email}</strong>
              </p>
            )}
            {error && (
              <p className="profile-password__error" role="alert">
                {error}
              </p>
            )}

            <form className="profile-password__form" onSubmit={handleSubmit} noValidate>
              <label className="profile-password__field">
                Сообщение
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={6}
                  disabled={!token || Boolean(error && !body)}
                />
              </label>

              <div className="profile-password__actions">
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting || !token || !body.trim() || Boolean(error && !body)}
                >
                  {submitting ? 'Отправляем...' : 'Отправить в поддержку'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
