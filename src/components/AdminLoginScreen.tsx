import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

interface AdminLoginScreenProps {
  error: string;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  busy?: boolean;
}

export function AdminLoginScreen({
  error,
  password,
  onPasswordChange,
  onSubmit,
  busy = false,
}: AdminLoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="admin-page admin-page--gate">
      <Link to="/" className="admin-page__back">
        <ArrowLeft size={20} />
        На главную
      </Link>

      <div className="admin-login-card">
        <h1>
          <span className="mono">&lt;/&gt;</span> ADMIN
        </h1>

        <form className="admin-login" onSubmit={onSubmit}>
          <label>
            Пароль администратора
            <span className="admin-login__password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="ADMIN_PASSWORD из .env"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="admin-login__password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <button type="submit" className="btn btn--primary" disabled={!password || busy}>
            {busy ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="admin-login__hint mono">
          Пароль из <code>ADMIN_PASSWORD</code> в `.env`. Локально: <code>admin123</code>
        </p>

        {error && <p className="admin-page__error">{error}</p>}
      </div>
    </div>
  );
}
