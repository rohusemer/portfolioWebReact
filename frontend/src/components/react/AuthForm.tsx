import { useState, type FormEvent } from 'react';
import { blankProfile, claimUsername, ensureUserProfile, fetchProfile, getFirebaseApp, saveProfile } from '../../lib/firebase';
import UsernameField, { type UsernameStatus } from './UsernameField';
import { resizeImageFile } from '../../lib/image';
import type { User } from 'firebase/auth';
import { startSession } from '../../lib/session';
import { authErrorMessage } from '../../lib/authErrors';

type Mode = 'login' | 'register' | 'reset';

/** Contraseña segura: 8+ caracteres, con letras y números. */
function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return 'Mínimo 8 caracteres.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Debe incluir letras y números.';
  return null;
}

const input =
  'w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm text-dark-text dark:text-light-text focus:outline-none focus:ring-2 focus:ring-primary';

/**
 * Acceso a la plataforma: iniciar sesión o registrarse con correo y contraseña,
 * o continuar con Google. Las contraseñas las gestiona Firebase Auth (se guardan
 * con hash scrypt, nunca en nuestra base de datos).
 */
export default function AuthForm({ initialMode = 'login', onDone }: { initialMode?: Mode; onDone?: () => void }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [photo, setPhoto] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('empty');

  /**
   * Tras entrar: registra la ficha, crea su CV con la plantilla de ejemplo si aún
   * no tiene uno, y lleva a los usuarios a su CV personal (el administrador se queda).
   */
  const afterAuth = async (user: User, photoUrl?: string, newUsername?: string) => {
    const role = await ensureUserProfile(user);
    if (newUsername) await claimUsername(user.uid, newUsername).catch((e) => console.warn('No se pudo reservar el usuario:', e));
    if (role === 'owner') return onDone?.();
    if (role !== 'blocked' && !(await fetchProfile(user.uid).catch(() => null))) {
      await saveProfile(user.uid, blankProfile(user, photoUrl)).catch((e) => console.warn('No se pudo crear el CV inicial:', e));
    }
    if (location.pathname === '/mi-cv') onDone?.();
    else location.href = '/mi-cv';
  };

  const auth = async () => {
    await startSession(); // carga Firebase Auth y el listener de sesión
    const mod = await import('firebase/auth');
    return { mod, auth: mod.getAuth(getFirebaseApp()!) };
  };

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const msg = authErrorMessage(e);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const google = () =>
    run(async () => {
      const { mod, auth: a } = await auth();
      const { user } = await mod.signInWithPopup(a, new mod.GoogleAuthProvider());
      await afterAuth(user);
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'reset') {
      return run(async () => {
        const { mod, auth: a } = await auth();
        await mod.sendPasswordResetEmail(a, email.trim());
        setInfo('Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.');
      });
    }
    if (mode === 'register') {
      if (name.trim().length < 2) return setError('Escribe tu nombre.');
      if (usernameStatus !== 'ok') return setError(usernameStatus === 'taken' ? 'Ese nombre de usuario ya está en uso.' : 'Elige un nombre de usuario válido.');
      const issue = passwordIssues(password);
      if (issue) return setError(issue);
      if (password !== confirm) return setError('Las contraseñas no coinciden.');
      if (!photo) return setError('Agrega una foto de perfil: se mostrará en tu CV y en tu sitio web.');
      return run(async () => {
        const { mod, auth: a } = await auth();
        const { user } = await mod.createUserWithEmailAndPassword(a, email.trim(), password);
        await mod.updateProfile(user, { displayName: name.trim() });
        await user.reload();
        await mod.sendEmailVerification(user).catch(() => {});
        await afterAuth(a.currentUser ?? user, photo, username);
      });
    }
    return run(async () => {
      const { mod, auth: a } = await auth();
      const { user } = await mod.signInWithEmailAndPassword(a, email.trim(), password);
      await afterAuth(user);
    });
  };

  return (
    <div className="w-full text-left">
      {mode !== 'reset' && (
        <div className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" role="tablist">
          {(
            [
              ['login', 'Iniciar sesión'],
              ['register', 'Crear cuenta'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError('');
              }}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === m ? 'bg-white dark:bg-neutral-900 shadow text-primary' : 'text-dark-text/70 dark:text-light-text/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode !== 'reset' && (
        <>
          <button
            onClick={google}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-semibold text-dark-text dark:text-light-text hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            {mode === 'register' ? 'Registrarme con Google' : 'Continuar con Google'}
          </button>
          <div className="flex items-center gap-3 my-4 text-xs opacity-60 text-dark-text dark:text-light-text">
            <span className="flex-1 h-px bg-current opacity-30" />o con tu correo<span className="flex-1 h-px bg-current opacity-30" />
          </div>
        </>
      )}

      {mode === 'reset' && (
        <div className="mb-4 text-dark-text dark:text-light-text">
          <h3 className="font-bold">Recuperar contraseña</h3>
          <p className="text-xs opacity-70">Te enviaremos un enlace para crear una nueva.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && <PhotoPicker value={photo} onChange={setPhoto} onError={setError} />}
        {mode === 'register' && (
          <input className={input} placeholder="Nombre completo" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        )}
        {mode === 'register' && <UsernameField value={username} onChange={setUsername} onStatus={setUsernameStatus} />}
        <input
          className={input}
          type="email"
          placeholder="Correo electrónico"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={150}
          required
        />
        {mode !== 'reset' && (
          <div className="relative">
            <input
              className={`${input} pr-10`}
              type={showPw ? 'text' : 'password'}
              placeholder="Contraseña"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-dark-text/60 dark:text-light-text/60"
            >
              <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
        )}
        {mode === 'register' && (
          <>
            <input
              className={input}
              type={showPw ? 'text' : 'password'}
              placeholder="Repite la contraseña"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={128}
              required
            />
            <p className={`text-xs ${password && passwordIssues(password) ? 'text-amber-600' : 'opacity-60'} text-dark-text dark:text-light-text`}>
              <i className="fas fa-shield-halved mr-1" />
              {password ? (passwordIssues(password) ?? 'Contraseña segura ✔') : 'Mínimo 8 caracteres, con letras y números.'}
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#1d4ed8] to-[#0ea5e9] text-white text-sm font-semibold shadow hover:shadow-lg disabled:opacity-50"
        >
          {busy && <i className="fas fa-spinner fa-spin mr-2" />}
          {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear mi cuenta' : 'Enviar enlace'}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-dark-text/70 dark:text-light-text/70">
        {mode === 'login' && (
          <button onClick={() => setMode('reset')} className="hover:text-primary hover:underline">
            ¿Olvidaste tu contraseña?
          </button>
        )}
        {mode === 'reset' && (
          <button onClick={() => setMode('login')} className="hover:text-primary hover:underline">
            ← Volver a iniciar sesión
          </button>
        )}
        {mode === 'register' && <span>Al registrarte recibirás un correo para verificar tu cuenta.</span>}
      </div>
    </div>
  );
}

/** Selector de foto del registro (obligatoria): círculo con vista previa. */
function PhotoPicker({ value, onChange, onError }: { value: string; onChange: (v: string) => void; onError: (m: string) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <span className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 grid place-items-center bg-neutral-200 dark:bg-neutral-800 ring-2 ring-dashed ring-primary/40 group-hover:ring-primary">
        {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-camera text-xl text-primary/70" />}
      </span>
      <span className="text-sm text-dark-text dark:text-light-text">
        <strong className="block">{value ? 'Cambiar foto' : 'Agrega tu foto *'}</strong>
        <span className="text-xs opacity-60">Se verá en tu CV y en tu sitio web</span>
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            onChange(await resizeImageFile(f));
            onError('');
          } catch (err) {
            onError((err as Error).message);
          }
        }}
      />
    </label>
  );
}
