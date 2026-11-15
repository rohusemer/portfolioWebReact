import { useEffect, useState } from 'react';
import { isUsernameAvailable, usernameIssue } from '../../lib/firebase';

export type UsernameStatus = 'empty' | 'invalid' | 'checking' | 'taken' | 'ok';

/** Campo de nombre de usuario con validación y comprobación de disponibilidad en vivo. */
export default function UsernameField({
  value,
  onChange,
  onStatus,
}: {
  value: string;
  onChange: (v: string) => void;
  onStatus: (s: UsernameStatus) => void;
}) {
  const [status, setStatus] = useState<UsernameStatus>('empty');
  const issue = value ? usernameIssue(value) : null;

  useEffect(() => {
    let cancelled = false;
    const set = (s: UsernameStatus) => {
      if (!cancelled) {
        setStatus(s);
        onStatus(s);
      }
    };
    if (!value) return set('empty');
    if (issue) return set('invalid');
    set('checking');
    const t = setTimeout(() => {
      isUsernameAvailable(value)
        .then((free) => set(free ? 'ok' : 'taken'))
        .catch(() => set('ok')); // si falla la comprobación, la regla del servidor decidirá al guardar
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  const hint: Record<UsernameStatus, string> = {
    empty: 'Será tu dirección pública: /perfil?u=tu-usuario',
    invalid: issue ?? '',
    checking: 'Comprobando disponibilidad…',
    taken: 'Ese nombre ya está en uso.',
    ok: '¡Disponible!',
  };
  const color = status === 'ok' ? 'text-emerald-600' : status === 'taken' || status === 'invalid' ? 'text-red-500' : 'opacity-60';

  return (
    <div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60 text-dark-text dark:text-light-text">@</span>
        <input
          className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-7 pr-9 py-2.5 text-sm text-dark-text dark:text-light-text focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="nombre de usuario"
          autoComplete="username"
          value={value}
          maxLength={20}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
          required
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
          {status === 'checking' && <i className="fas fa-spinner fa-spin opacity-60" />}
          {status === 'ok' && <i className="fas fa-circle-check text-emerald-600" />}
          {(status === 'taken' || status === 'invalid') && <i className="fas fa-circle-xmark text-red-500" />}
        </span>
      </div>
      <p className={`text-xs mt-1 ${color} text-dark-text dark:text-light-text`}>{hint[status]}</p>
    </div>
  );
}
