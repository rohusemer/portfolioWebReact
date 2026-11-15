import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { blankProfile, fetchProfile, firebaseConfigured, isStaff, ROLE_LABELS, saveProfile } from '../../lib/firebase';
import { signIn, signOutUser, startSession, useSession } from '../../lib/session';
import { alertAuthError } from '../../lib/authErrors';
import { downloadCvPdf, previewCvPdf } from '../../lib/cvPdf';
import { cvFileBase, downloadFile, toMarkdown } from '../../lib/cvMarkdown';
import type { PortfolioData } from '../../lib/types';
import CvBuilder from './admin/CvBuilder';
import Editor from './admin/Editor';

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
          Regístrate con tu cuenta de Google, completa tu información y arma tu CV arrastrando bloques. Descárgalo en PDF cuando
          quieras.
        </p>
        <button onClick={() => signIn().catch(alertAuthError)} className="px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-accent">
          <i className="fab fa-google mr-2" />
          Entrar / Registrarme con Google
        </button>
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

  return <PersonalDashboard user={session.user} roleLabel={ROLE_LABELS[session.role]} staff={isStaff(session.role)} />;
}

function PersonalDashboard({ user, roleLabel, staff }: { user: User; roleLabel: string; staff: boolean }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [saved, setSaved] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [view, setView] = useState<'cv' | 'info'>('cv');
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
    const onLeave = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
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
        <a href="/" className="font-bold text-primary mr-2" title="Volver al portafolio">
          <i className="fas fa-id-card mr-1" /> Mi CV
        </a>
        <nav className="flex gap-1">
          {(
            [
              ['cv', 'fa-table-columns', 'Diseño del CV'],
              ['info', 'fa-user-pen', 'Mi información'],
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
        <span className="text-xs opacity-60 hidden xl:inline" title={`Rol: ${roleLabel}`}>
          {user.email}
        </span>
        <button onClick={() => signOutUser()} title="Cerrar sesión" className="text-sm px-2">
          <i className="fas fa-right-from-bracket" />
        </button>
      </header>

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
          topCard={
            <div className="rounded-xl p-3 mb-4 bg-primary/10 border border-primary/30">
              <div className="text-sm font-semibold mb-1">
                <i className="fas fa-file-pdf text-primary mr-1" /> Tu CV en PDF
              </div>
              <p className="text-xs opacity-75 mb-3">Haz clic en un bloque para editarlo y arrástralo para reordenarlo. Descarga tu CV cuando quieras.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => runPdf(previewCvPdf, 'Generando vista previa…')}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-white/80 dark:bg-neutral-800"
                >
                  <i className="fas fa-eye mr-1" /> Vista previa
                </button>
                <button
                  onClick={() => runPdf(downloadCvPdf, 'Generando tu PDF…')}
                  className="flex-[2] px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-accent"
                >
                  <i className="fas fa-download mr-1" /> Descargar PDF
                </button>
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
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto">
            <Editor data={data} onChange={setData} only={['profile', 'contact', 'experience', 'education', 'skills', 'projects', 'extra']} />
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
