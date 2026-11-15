import { useEffect, useRef, useState } from 'react';
import { firebaseConfigured, isStaff, ROLE_LABELS } from '../../lib/firebase';
import { alertAuthError } from '../../lib/authErrors';
import { resumeSessionIfHinted, setEditMode, signIn, signOutUser, useSession } from '../../lib/session';

/** Botón de sesión del header: login con Google, avatar y menú de administrador. */
export default function AuthButton() {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(resumeSessionIfHinted, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  if (!firebaseConfigured) return null;

  if (session.status !== 'in' || !session.user) {
    return (
      <button
        onClick={() => signIn().catch(alertAuthError)}
        disabled={session.status === 'loading'}
        title="Iniciar sesión"
        className="text-sm text-dark-text/70 dark:text-light-text/70 hover:text-primary disabled:opacity-50"
      >
        <i className="fas fa-right-to-bracket md:mr-1" />
        <span className="hidden md:inline">Entrar</span>
      </button>
    );
  }

  const { user, role, editMode } = session;
  const initial = (user.displayName || user.email || '?')[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1" title={user.email ?? ''}>
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full ring-2 ring-primary" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-primary text-white grid place-items-center font-bold">{initial}</span>
        )}
        {isStaff(role) && <i className="fas fa-crown text-amber-500 text-xs" title={`Rol: ${role}`} />}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            <div className="font-semibold truncate">{user.displayName || user.email}</div>
            <div className="text-xs opacity-60 truncate">{user.email}</div>
            <div className={`text-xs mt-1 font-semibold ${isStaff(role) ? 'text-amber-600' : role === 'blocked' ? 'text-red-500' : 'opacity-60'}`}>
              Rol: {role ? ROLE_LABELS[role] : 'sin registrar'}
            </div>
          </div>
          {role && role !== 'blocked' && (
            <a href="/mi-cv" className="block px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <i className="fas fa-id-card w-5" /> Mi CV personal
            </a>
          )}
          {isStaff(role) && (
            <>
              <label className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
                <span>
                  <i className="fas fa-pen w-5" /> Modo edición
                </span>
                <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              </label>
              <a href="/admin" className="block px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <i className="fas fa-sliders w-5" /> Panel de administración
              </a>
            </>
          )}
          <button
            onClick={() => signOutUser()}
            className="w-full text-left px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-red-500"
          >
            <i className="fas fa-right-from-bracket w-5" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
