import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import AuthForm from './AuthForm';
import Logo from './LogoMark';

/** Modal de acceso que se abre con el evento global "open-auth" (botón "Entrar"). */
export default function AuthModal() {
  const [mode, setMode] = useState<'login' | 'register' | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setMode(((e as CustomEvent).detail as 'login' | 'register') ?? 'login');
    window.addEventListener('open-auth', onOpen);
    return () => window.removeEventListener('open-auth', onOpen);
  }, []);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMode(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  if (!mode) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={() => setMode(null)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Acceso"
        className="relative w-full max-w-sm rounded-2xl bg-light-bg dark:bg-dark-bg shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMode(null)}
          aria-label="Cerrar"
          className="absolute right-3 top-3 w-8 h-8 rounded-full text-dark-text dark:text-light-text hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          <i className="fas fa-xmark" />
        </button>
        <div className="flex flex-col items-center mb-5 text-center">
          <Logo size={44} />
          <h2 className="mt-2 text-lg font-bold text-dark-text dark:text-light-text">Bienvenido</h2>
          <p className="text-xs opacity-70 text-dark-text dark:text-light-text">Crea tu cuenta para armar y descargar tu propio CV.</p>
        </div>
        <AuthForm key={mode} initialMode={mode} onDone={() => setMode(null)} />
      </div>
    </div>,
    document.body,
  );
}
