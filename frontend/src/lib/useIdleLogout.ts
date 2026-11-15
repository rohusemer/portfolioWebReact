import { useEffect, useState } from 'react';
import { signOutUser } from './session';

/**
 * Factor de sesión: cierra la sesión tras `minutes` sin actividad (ratón,
 * teclado, toques o scroll). Avisa un minuto antes. Devuelve true mientras
 * se muestra el aviso.
 */
export function useIdleLogout(minutes = 30): boolean {
  const [warning, setWarning] = useState(false);
  useEffect(() => {
    let warnTimer: ReturnType<typeof setTimeout>;
    let outTimer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setWarning(false);
      clearTimeout(warnTimer);
      clearTimeout(outTimer);
      warnTimer = setTimeout(() => setWarning(true), (minutes - 1) * 60_000);
      outTimer = setTimeout(async () => {
        await signOutUser();
        alert('Tu sesión se cerró por inactividad. Vuelve a iniciar sesión para continuar.');
        location.href = '/';
      }, minutes * 60_000);
    };
    const events = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(warnTimer);
      clearTimeout(outTimer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes]);
  return warning;
}
