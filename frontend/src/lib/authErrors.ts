/** Traduce los errores comunes de Firebase Auth a mensajes claros. Devuelve null si no hay que mostrar nada. */
export function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con Google no está habilitado en Firebase. Actívalo en la consola: Authentication → Método de acceso → Google.';
    case 'auth/unauthorized-domain':
      return `Este dominio (${location.hostname}) no está autorizado. Agrégalo en Firebase: Authentication → Configuración → Dominios autorizados.`;
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Error de red. Revisa tu conexión e inténtalo de nuevo.';
    default:
      return `No se pudo iniciar sesión: ${(err as Error)?.message ?? code}`;
  }
}

export function alertAuthError(err: unknown) {
  const msg = authErrorMessage(err);
  if (msg) alert(msg);
}
