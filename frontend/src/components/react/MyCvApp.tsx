import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { atLeast, blankProfile, claimUsername, fetchMyUsername, fetchProfile, firebaseConfigured, isStaff, levelIn, saveProfile, type Permissions, type PermSection, type Role } from '../../lib/firebase';
import { signOutUser, startSession, useSession } from '../../lib/session';
import AuthForm from './AuthForm';
import { downloadCvPdf } from '../../lib/cvPdf';
import { cvFileBase, downloadFile, toMarkdown } from '../../lib/cvMarkdown';
import type { PortfolioData } from '../../lib/types';
import CvBuilder from './admin/CvBuilder';
import Editor from './admin/Editor';
import AccountPanel from './AccountPanel';
import UsernameField, { type UsernameStatus } from './UsernameField';
import PortfolioSections from './PortfolioSections';
import { useIdleLogout } from '../../lib/useIdleLogout';

/** Página /mi-cv: cada usuario registrado arma, guarda y descarga su propio CV. */
export default function MyCvApp() {
  const session = useSession();

  useEffect(() => {
    startSession();
  }, []);

  if (!firebaseConfigured) return <Centered>Firebase no está configurado.</Centered>;
  if (session.status === 'idle' || session.status === 'loading') return <Centered>Cargando…</Centered>;

  if (session.status === 'out' || !session.user) {
    return (
      <Centered>
        <i className="fas fa-id-card text-5xl text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">Crea tu CV profesional</h1>
        <p className="text-sm opacity-80 mb-6">
          Regístrate con tu correo o con Google, completa tu información y arma tu CV arrastrando bloques. Descárgalo en PDF cuando
          quieras.
        </p>
        <AuthForm initialMode="register" />
        <p className="mt-6">
          <a href="/" className="text-sm underline opacity-70">
            Volver al portafolio
          </a>
        </p>
      </Centered>
    );
  }

  if (session.role === 'blocked') {
    return (
      <Centered>
        <i className="fas fa-ban text-4xl text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Cuenta bloqueada</h1>
        <p className="text-sm opacity-80 mb-6">Tu cuenta no tiene acceso. Si crees que es un error, contacta al administrador.</p>
        <button onClick={() => signOutUser()} className="text-sm underline">
          Cerrar sesión
        </button>
      </Centered>
    );
  }

  if (!session.role) {
    return (
      <Centered>
        <p className="text-sm mb-4">No se pudo completar tu registro. Recarga la página para intentarlo de nuevo.</p>
        <button onClick={() => location.reload()} className="px-4 py-2 rounded-lg bg-primary text-white">
          Recargar
        </button>
      </Centered>
    );
  }

  // Segundo factor del registro: las cuentas de correo deben verificarlo antes de usar la plataforma
  if (session.role !== 'owner' && !session.user.emailVerified) return <VerifyEmailGate user={session.user} />;

  return (
    <UsernameGate user={session.user} skip={session.role === 'owner'}>
      {(username) => <PersonalDashboard user={session.user!} role={session.role!} permissions={session.permissions} username={username} />}
    </UsernameGate>
  );
}

function PersonalDashboard({ user, role, permissions, username }: { user: User; role: Role; permissions: Permissions; username: string | null }) {
  const staff = isStaff(role);
  // Lo que el administrador le permite hacer en cada sección de su CV
  const levelOf = (sec: PermSection) => (role === 'owner' ? 'create' : levelIn(permissions, sec));
  const canDownload = levelOf('pdf') !== 'none';
  const canDesign = atLeast(levelOf('cv'), 'edit');
  const idleWarning = useIdleLogout(30);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [saved, setSaved] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [view, setView] = useState<'cv' | 'info' | 'site' | 'account'>('cv');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'busy'; msg: string } | null>(null);

  useEffect(() => {
    fetchProfile(user.uid)
      .then((p) => {
        const d = p ?? blankProfile(user);
        setIsNew(!p);
        setData(d);
        setSaved(JSON.stringify(d));
        if (!p) setStatus({ kind: 'ok', msg: '¡Bienvenido! 👋 Completa tu información en “Mi información” y arma tu CV aquí. No olvides guardar.' });
      })
      .catch((e) => setStatus({ kind: 'err', msg: `No se pudo cargar tu CV: ${e.message}` }));
  }, [user.uid]);

  const dirty = data !== null && (isNew || JSON.stringify(data) !== saved);
  const leaving = useRef(false);
  const exitToSite = () => {
    if (dirty && !confirm('Tienes cambios sin guardar. ¿Salir al sitio sin guardarlos?')) return;
    leaving.current = true;
    window.location.href = '/';
  };

  const save = useCallback(async () => {
    if (!data) return;
    const clean = { ...data, hobbies: data.hobbies.map((h) => h.trim()).filter(Boolean), updatedAt: new Date().toISOString() };
    setStatus({ kind: 'busy', msg: 'Guardando…' });
    try {
      await saveProfile(user.uid, clean);
      setData(clean);
      setSaved(JSON.stringify(clean));
      setIsNew(false);
      setStatus({ kind: 'ok', msg: 'CV guardado ✔' });
    } catch (e) {
      setStatus({ kind: 'err', msg: `Error al guardar: ${(e as Error).message}` });
    }
  }, [data, user.uid]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => dirty && !leaving.current && e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [save, dirty]);

  const runPdf = async (fn: (d: PortfolioData) => Promise<void>, msg: string) => {
    if (!data) return;
    setStatus({ kind: 'busy', msg });
    try {
      await fn(data);
      setStatus(null);
    } catch (e) {
      setStatus({ kind: 'err', msg: `No se pudo generar el PDF: ${(e as Error).message}` });
    }
  };

  if (!data) return <Centered>{status?.msg ?? 'Cargando tu CV…'}</Centered>;

  return (
    <div className="h-screen flex flex-col">
      <header className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-300 dark:border-neutral-800 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur">
        <button
          onClick={exitToSite}
          title="Volver al sitio (sin guardar)"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-300 dark:border-neutral-700 hover:border-primary hover:text-primary"
        >
          <i className="fas fa-arrow-left mr-1" /> Salir al sitio
        </button>
        <span className="font-bold text-primary mr-2">
          <i className="fas fa-id-card mr-1" /> Mi CV
        </span>
        <nav className="flex gap-1">
          {(
            [
              ['cv', 'fa-table-columns', 'Diseño del CV'],
              ['info', 'fa-user-pen', 'Mi información'],
              ['site', 'fa-globe', 'Mi sitio web'],
              ['account', 'fa-user-gear', 'Mi cuenta'],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                view === key ? 'bg-primary text-white' : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              <i className={`fas ${icon} mr-1`} />
              {label}
            </button>
          ))}
        </nav>
        <span className={`text-xs px-2 py-0.5 rounded-full ${dirty ? 'bg-amber-500/20 text-amber-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
          {dirty ? 'Sin guardar' : 'Guardado'}
        </span>
        <div className="flex-1" />
        {staff && (
          <a href="/admin" className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold">
            <i className="fas fa-crown mr-1" /> Panel admin
          </a>
        )}
        <button
          onClick={save}
          disabled={!dirty}
          title="Ctrl + S"
          className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-accent disabled:opacity-40"
        >
          <i className="fas fa-cloud-arrow-up mr-1" /> Guardar
        </button>
        <span className="text-xs opacity-60 hidden xl:inline" title={`Rol: ${role}`}>
          {username ? `@${username}` : user.email}
        </span>
        <button onClick={() => signOutUser()} title="Cerrar sesión" className="text-sm px-2">
          <i className="fas fa-right-from-bracket" />
        </button>
      </header>

      {idleWarning && (
        <div className="px-4 py-2 text-sm bg-red-500/15 text-red-700 dark:text-red-300">
          <i className="fas fa-clock mr-1" /> Por seguridad, tu sesión se cerrará en 1 minuto por inactividad. Mueve el ratón para continuar.
        </div>
      )}

      {status && (
        <div
          className={`px-4 py-2 text-sm ${
            status.kind === 'err' ? 'bg-red-500/15 text-red-600' : status.kind === 'busy' ? 'bg-neutral-500/15' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {status.kind === 'busy' && <i className="fas fa-spinner fa-spin mr-2" />}
          {status.msg}
          {status.kind !== 'busy' && (
            <button className="float-right" onClick={() => setStatus(null)}>
              ✕
            </button>
          )}
        </div>
      )}

      {view === 'cv' ? (
        <CvBuilder
          data={data}
          onChange={setData}
          readOnly={!canDesign}
          levelOf={levelOf}
          topCard={
            <div className="rounded-xl p-3 mb-4 bg-primary/10 border border-primary/30">
              <div className="text-sm font-semibold mb-1">
                <i className="fas fa-file-pdf text-primary mr-1" /> Tu CV en PDF
              </div>
              <p className="text-xs opacity-75 mb-3">Haz clic en un bloque para editarlo y arrástralo para reordenarlo. Descarga tu CV cuando quieras.</p>
              <div className="flex gap-2">
                {canDownload ? (
                <button
                  onClick={() => runPdf(downloadCvPdf, 'Generando tu PDF…')}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-accent"
                >
                  <i className="fas fa-download mr-1" /> Descargar PDF
                </button>
                ) : (
                  <p className="text-xs opacity-70">
                    <i className="fas fa-lock mr-1" /> La descarga del PDF no está habilitada para tu cuenta.
                  </p>
                )}
              </div>
              <button
                onClick={() => downloadFile(`${cvFileBase(data)}.md`, toMarkdown(data), 'text/markdown')}
                className="mt-2 w-full text-xs opacity-70 hover:opacity-100"
              >
                <i className="fab fa-markdown mr-1" /> Exportar en Markdown
              </button>
            </div>
          }
        />
      ) : view === 'site' ? (
        <div className="flex-1 overflow-y-auto bg-neutral-200/60 dark:bg-neutral-900/60 p-4">
          <p className="max-w-5xl mx-auto mb-3 text-xs opacity-70">
            <i className="fas fa-circle-info mr-1" /> Así se ve tu sitio web con tu información. Edítala en “Mi información” (el texto de
            “Sobre mí (web)” está en Perfil). {role === 'premium' ? 'Puedes publicarlo desde “Mi cuenta”.' : 'Con el plan Premium puedes publicarlo y compartir el enlace.'}
          </p>
          <div className="max-w-5xl mx-auto rounded-xl bg-light-bg dark:bg-dark-bg shadow">
            <PortfolioSections initialData={data} live={false} />
          </div>
        </div>
      ) : view === 'account' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <AccountPanel
            user={user}
            username={username}
            role={role}
            data={data}
            onTogglePublic={async (isPublic) => {
              const next = { ...data, isPublic, updatedAt: new Date().toISOString() };
              try {
                await saveProfile(user.uid, next);
                setData(next);
                setSaved(JSON.stringify(next));
                setIsNew(false);
              } catch (e) {
                setStatus({ kind: 'err', msg: `No se pudo cambiar la visibilidad: ${(e as Error).message}` });
              }
            }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            <Editor data={data} onChange={setData} levelOf={levelOf} only={['profile', 'contact', 'experience', 'education', 'skills', 'projects', 'extra']} />
          </div>
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl p-8 bg-white/70 dark:bg-neutral-900/70 shadow-xl">{children}</div>
    </div>
  );
}

/** Pantalla obligatoria hasta que el usuario verifique su correo (segundo factor del registro). */
function VerifyEmailGate({ user }: { user: User }) {
  const [state, setState] = useState<'idle' | 'sent' | 'checking' | 'pending' | 'error'>('idle');

  const resend = async () => {
    try {
      const { sendEmailVerification } = await import('firebase/auth');
      await sendEmailVerification(user);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  const check = async () => {
    setState('checking');
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true); // renueva el token para que las reglas vean el correo verificado
      location.reload();
    } else setState('pending');
  };

  return (
    <Centered>
      <i className="fas fa-envelope-circle-check text-5xl text-primary mb-4" />
      <h1 className="text-2xl font-bold mb-2">Verifica tu correo</h1>
      <p className="text-sm opacity-80 mb-1">Te enviamos un enlace de verificación a</p>
      <p className="font-semibold mb-4 break-all">{user.email}</p>
      <p className="text-xs opacity-70 mb-6">Ábrelo (revisa también spam) y luego pulsa el botón. Es un paso de seguridad para proteger tu cuenta.</p>
      <button onClick={check} disabled={state === 'checking'} className="w-full mb-2 px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-accent disabled:opacity-50">
        {state === 'checking' ? 'Comprobando…' : 'Ya lo verifiqué'}
      </button>
      <button onClick={resend} className="w-full mb-4 px-5 py-2 rounded-lg border border-primary text-primary text-sm font-semibold">
        Reenviar correo
      </button>
      {state === 'sent' && <p className="text-xs text-emerald-600 mb-2">Correo reenviado ✔</p>}
      {state === 'pending' && <p className="text-xs text-amber-600 mb-2">Aún no aparece como verificado. Abre el enlace del correo e inténtalo de nuevo.</p>}
      {state === 'error' && <p className="text-xs text-red-500 mb-2">No se pudo reenviar. Espera unos minutos.</p>}
      <button onClick={() => signOutUser()} className="text-xs underline opacity-70">
        Cerrar sesión
      </button>
    </Centered>
  );
}

/** Pide elegir un nombre de usuario a quien aún no tiene (registro con Google o cuentas antiguas). */
function UsernameGate({ user, skip, children }: { user: User; skip: boolean; children: (username: string | null) => ReactNode }) {
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('empty');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyUsername(user.uid)
      .then(setUsername)
      .catch(() => setUsername(null));
  }, [user.uid]);

  if (username === undefined) return <Centered>Cargando…</Centered>;
  if (username || skip) return <>{children(username)}</>;

  const save = async () => {
    if (status !== 'ok') return;
    setSaving(true);
    setError('');
    try {
      await claimUsername(user.uid, value);
      setUsername(value);
    } catch {
      setError('Ese nombre acaba de ser tomado o no es válido. Prueba con otro.');
      setSaving(false);
    }
  };

  return (
    <Centered>
      <i className="fas fa-at text-4xl text-primary mb-4" />
      <h1 className="text-2xl font-bold mb-2">Elige tu nombre de usuario</h1>
      <p className="text-sm opacity-80 mb-5">Te identificará en la plataforma y será la dirección de tu sitio público. No podrás cambiarlo después.</p>
      <div className="text-left mb-4">
        <UsernameField value={value} onChange={setValue} onStatus={setStatus} />
      </div>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <button onClick={save} disabled={status !== 'ok' || saving} className="w-full px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-accent disabled:opacity-40">
        {saving ? 'Guardando…' : 'Continuar'}
      </button>
    </Centered>
  );
}
