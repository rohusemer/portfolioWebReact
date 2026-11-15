/** Traduce los errores comunes de Firebase Auth a mensajes claros. Devuelve null si no hay que mostrar nada. */
export function authErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Este método de acceso no está habilitado en Firebase. Actívalo en la consola: Authentication → Método de acceso (Google y/o Correo electrónico/contraseña).';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.';
    case 'auth/invalid-email':
      return 'El correo no es válido.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.';
    case 'auth/missing-password':
      return 'Escribe tu contraseña.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/account-exists-with-different-credential':
      return 'Ese correo ya está registrado con otro método. Entra con el método que usaste al registrarte.';
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
