import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { fetchCvPdfMeta, fetchPortfolio, ensureUserProfile, isStaff, listContactMessages, publishCvPdf, firebaseConfigured, getFirebaseApp, savePortfolio, seedData, withDefaults, type Role } from '../../../lib/firebase';
import type { CvPdfMeta, PortfolioData } from '../../../lib/types';
import { cvFileBase, downloadFile, toMarkdown } from '../../../lib/cvMarkdown';
import PortfolioSections from '../PortfolioSections';
import CvBuilder, { PublishCard } from './CvBuilder';
import { previewCvPdf, renderCvPdf } from '../../../lib/cvPdf';
import Editor from './Editor';
import Messages from './Messages';
import Users from './Users';
import { alertAuthError } from '../../../lib/authErrors';

type AuthState = { status: 'loading' } | { status: 'out' } | { status: 'in'; user: User; role: Role | null };

export default function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const app = getFirebaseApp();
    if (!app) return;
    return onAuthStateChanged(getAuth(app), async (user) => {
      if (!user) return setAuth({ status: 'out' });
      setAuth({ status: 'in', user, role: await ensureUserProfile(user).catch(() => null) });
    });
  }, []);

  if (!firebaseConfigured) {
    return (
      <Centered>
        <h1 className="text-2xl font-bold mb-2">Firebase no está configurado</h1>
        <p className="text-sm opacity-80">
          Copia <code>frontend/.env.example</code> a <code>frontend/.env</code> y completa las variables{' '}
          <code>PUBLIC_FIREBASE_*</code> con la configuración web de tu proyecto. Luego reinicia <code>pnpm dev</code>.
        </p>
      </Centered>
    );
  }

  if (auth.status === 'loading') return <Centered>Cargando…</Centered>;

  if (auth.status === 'out') {
    return (
      <Centered>
        <i className="fas fa-lock text-4xl text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">Panel de administración</h1>
        <p className="text-sm opacity-80 mb-6">Inicia sesión para editar tu portafolio y generar tu CV.</p>
        <button
          onClick={() => signInWithPopup(getAuth(getFirebaseApp()!), new GoogleAuthProvider()).catch(alertAuthError)}
          className="px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-accent"
        >
          <i className="fab fa-google mr-2" />
          Entrar con Google
        </button>
      </Centered>
    );
  }

  if (!isStaff(auth.role)) {
    return (
      <Centered>
        <i className="fas fa-user-shield text-4xl text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Sin acceso al panel</h1>
        <p className="text-sm opacity-80 mb-4">
          Sesión iniciada como <strong>{auth.user.email}</strong>. El panel de administración es solo para propietarios y editores.
        </p>
        {auth.role !== 'blocked' && (
          <a href="/mi-cv" className="inline-block mb-4 px-5 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-accent">
            <i className="fas fa-id-card mr-2" /> Ir a mi CV personal
          </a>
        )}
        <details className="text-xs opacity-70 mb-4 text-left">
          <summary className="cursor-pointer">¿Eres el dueño del sitio?</summary>
          <p className="mt-2">
            En la consola de Firebase abre Firestore → <code>users</code> → tu documento y cambia el campo <code>role</code> a{' '}
            <code>owner</code>. Tu UID es:
          </p>
          <code className="block select-all p-2 mt-1 rounded bg-neutral-200 dark:bg-neutral-800 break-all">{auth.user.uid}</code>
        </details>
        <button onClick={() => signOut(getAuth(getFirebaseApp()!))} className="text-sm underline">
          Cerrar sesión
        </button>
      </Centered>
    );
  }

  return <Dashboard user={auth.user} role={auth.role!} />;
}

type View = 'cv' | 'content' | 'messages' | 'users';

function Dashboard({ user, role }: { user: User; role: Role }) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [isNew, setIsNew] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'busy'; msg: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('cv');
  const [unread, setUnread] = useState(0);
  const [pdfMeta, setPdfMeta] = useState<CvPdfMeta | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    listContactMessages()
      .then((m) => setUnread(m.filter((x) => !x.read).length))
      .catch(() => {});
    fetchCvPdfMeta().then(setPdfMeta);
  }, []);

  const dirty = data !== null && JSON.stringify(data) !== saved;

  const load = useCallback(async () => {
    setStatus({ kind: 'busy', msg: 'Cargando…' });
    try {
      const remote = await fetchPortfolio();
      const d = remote ?? structuredClone(seedData);
      setIsNew(!remote);
      setData(d);
      setSaved(JSON.stringify(d));
      setStatus(remote ? null : { kind: 'ok', msg: 'Aún no hay datos en Firestore: se cargó el contenido inicial. Guarda para publicarlo.' });
    } catch (e) {
      setStatus({ kind: 'err', msg: `Error al cargar: ${(e as Error).message}` });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Guarda en Firestore y devuelve los datos guardados (o null si falló). */
  const save = useCallback(async (): Promise<PortfolioData | null> => {
    if (!data) return null;
    const clean: PortfolioData = {
      ...data,
      hobbies: data.hobbies.map((h) => h.trim()).filter(Boolean),
      updatedAt: new Date().toISOString(),
    };
    setStatus({ kind: 'busy', msg: 'Guardando…' });
    try {
      await savePortfolio(clean);
      setData(clean);
      setSaved(JSON.stringify(clean));
      setIsNew(false);
      setStatus({ kind: 'ok', msg: 'Cambios guardados y visibles en la web ✔' });
      return clean;
    } catch (e) {
      setStatus({ kind: 'err', msg: `Error al guardar: ${(e as Error).message}` });
      return null;
    }
  }, [data]);

  /** Guarda, genera el PDF y lo publica para que el bot lo entregue. */
  const publishPdf = async () => {
    setPublishing(true);
    try {
      const d = await save();
      if (!d) return;
      setStatus({ kind: 'busy', msg: 'Generando PDF…' });
      const { base64, fileName } = await renderCvPdf(d);
      const meta = await publishCvPdf(base64, fileName);
      setPdfMeta(meta);
      setStatus({ kind: 'ok', msg: `PDF publicado ✔ El bot ya entrega “${fileName}” a quien lo pida.` });
    } catch (e) {
      setStatus({ kind: 'err', msg: `Error al publicar el PDF: ${(e as Error).message}` });
    } finally {
      setPublishing(false);
    }
  };

  const previewPdf = async () => {
    if (!data) return;
    setStatus({ kind: 'busy', msg: 'Generando vista previa…' });
    try {
      await previewCvPdf(data);
      setStatus(null);
    } catch (e) {
      setStatus({ kind: 'err', msg: `No se pudo generar el PDF: ${(e as Error).message}` });
    }
  };

  // Ctrl/Cmd + S para guardar, y aviso al salir con cambios sin guardar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [save, dirty]);

  const importJson = async (file: File) => {
    try {
      setData(withDefaults(JSON.parse(await file.text())));
      setStatus({ kind: 'ok', msg: 'JSON importado. Revisa y guarda para publicar.' });
    } catch {
      setStatus({ kind: 'err', msg: 'El archivo no es un JSON válido.' });
    }
  };

  if (!data) return <Centered>{status?.msg ?? 'Cargando…'}</Centered>;

  const tabs: { key: View; icon: string; label: string; badge?: number }[] = [
    { key: 'cv', icon: 'fa-table-columns', label: 'Constructor de CV' },
    { key: 'content', icon: 'fa-pen', label: 'Contenido web' },
    { key: 'messages', icon: 'fa-inbox', label: 'Mensajes', badge: unread },
    ...(role === 'owner' ? [{ key: 'users' as View, icon: 'fa-users', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="h-screen flex flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-neutral-300 dark:border-neutral-800 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur">
        <a href="/" className="font-bold text-primary mr-2" title="Ver el sitio">
          <i className="fas fa-pen-nib mr-1" /> Admin
        </a>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold ${
                view === t.key ? 'bg-primary text-white' : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              <i className={`fas ${t.icon} mr-1`} />
              {t.label}
              {!!t.badge && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] grid place-items-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <span className={`text-xs px-2 py-0.5 rounded-full ${dirty || isNew ? 'bg-amber-500/20 text-amber-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
          {dirty || isNew ? 'Sin guardar' : 'Guardado'}
        </span>
        <div className="flex-1" />
        <ToolBtn icon="fa-file-lines" label="MD" onClick={() => downloadFile(`${cvFileBase(data)}.md`, toMarkdown(data), 'text/markdown')} />
        <ToolBtn icon="fa-download" label="JSON" onClick={() => downloadFile('portfolio.json', JSON.stringify(data, null, 2), 'application/json')} />
        <ToolBtn icon="fa-upload" label="Importar" onClick={() => fileInput.current?.click()} />
        <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        <ToolBtn icon="fa-rotate-left" label="Descartar" disabled={!dirty} onClick={() => confirm('¿Descartar cambios no guardados?') && load()} />
        <button
          onClick={() => save()}
          disabled={!dirty && !isNew}
          className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-accent disabled:opacity-40"
          title="Ctrl + S"
        >
          <i className="fas fa-cloud-arrow-up mr-1" /> Guardar
        </button>
        <span className="text-xs opacity-60 hidden xl:inline" title={`Rol: ${role}`}>
          {user.email}
        </span>
        <button onClick={() => signOut(getAuth(getFirebaseApp()!))} title="Cerrar sesión" className="text-sm px-2">
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

      {view === 'cv' && (
        <CvBuilder
          data={data}
          onChange={setData}
          topCard={
            <PublishCard pdfMeta={pdfMeta} updatedAt={data.updatedAt} publishing={publishing} onPublish={publishPdf} onPreviewPdf={previewPdf} />
          }
        />
      )}

      {view === 'content' && (
        <div className="flex-1 grid lg:grid-cols-[minmax(380px,520px)_1fr] min-h-0">
          <section className="p-4 overflow-y-auto lg:h-[calc(100vh-49px)] border-r border-neutral-300 dark:border-neutral-800">
            <Editor data={data} onChange={setData} />
          </section>
          <section className="p-4 overflow-y-auto lg:h-[calc(100vh-49px)] bg-neutral-200/60 dark:bg-neutral-900/60">
            <p className="text-center text-xs font-semibold mb-3 opacity-70">Vista previa de la web</p>
            <div className="rounded-xl bg-light-bg dark:bg-dark-bg">
              <PortfolioSections initialData={data} live={false} />
            </div>
          </section>
        </div>
      )}

      {view === 'users' && role === 'owner' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <Users currentUid={user.uid} />
        </div>
      )}

      {view === 'messages' && (
        <div className="flex-1 p-4 overflow-y-auto">
          <Messages onUnread={setUnread} />
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 disabled:opacity-40"
    >
      <i className={`fas ${icon} mr-1`} />
      {label}
    </button>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-xl p-8 bg-white/70 dark:bg-neutral-900/70 shadow-xl">{children}</div>
    </div>
  );
}
