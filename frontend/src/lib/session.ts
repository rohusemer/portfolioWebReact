// Estado de sesión compartido entre las "islas" de React de una misma página
// (header, secciones del portafolio, bot). Firebase Auth se carga de forma
// diferida: solo si el usuario pulsa "Iniciar sesión" o ya había entrado antes.

import { useSyncExternalStore } from 'react';
import type { User } from 'firebase/auth';
import { ensureUserAccess, getFirebaseApp, isStaff, type Permissions, type Role } from './firebase';

export interface SessionState {
  status: 'idle' | 'loading' | 'out' | 'in';
  user: User | null;
  role: Role | null;
  permissions: Permissions;
  editMode: boolean;
}

const HINT_KEY = 'pf_session_hint';
const EDIT_KEY = 'pf_edit_mode';

let state: SessionState = { status: 'idle', user: null, role: null, permissions: {}, editMode: false };
const listeners = new Set<() => void>();

function set(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const storage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {
      /* modo privado */
    }
  },
};

let started: Promise<void> | null = null;

/** Inicializa Firebase Auth (una sola vez) y escucha cambios de sesión. */
export function startSession(): Promise<void> {
  if (started) return started;
  const app = getFirebaseApp();
  if (!app) {
    set({ status: 'out' });
    return (started = Promise.resolve());
  }
  set({ status: 'loading' });
  started = import('firebase/auth').then(({ getAuth, onAuthStateChanged }) => {
    onAuthStateChanged(getAuth(app), async (user) => {
      if (!user) {
        storage.set(HINT_KEY, null);
        return set({ status: 'out', user: null, role: null, permissions: {}, editMode: false });
      }
      storage.set(HINT_KEY, '1');
      const access = await ensureUserAccess(user).catch((e) => {
        console.error('No se pudo registrar el usuario:', e);
        return null;
      });
      const role = access?.role ?? null;
      set({ status: 'in', user, role, permissions: access?.permissions ?? {}, editMode: isStaff(role) && storage.get(EDIT_KEY) === '1' });
    });
  });
  return started;
}

/** Arranca la sesión automáticamente solo si el usuario ya había iniciado sesión. */
export function resumeSessionIfHinted() {
  if (typeof window !== 'undefined' && storage.get(HINT_KEY)) startSession();
}

/** Abre el modal de acceso (iniciar sesión / crear cuenta / Google). */
export async function signIn(mode: 'login' | 'register' = 'login') {
  window.dispatchEvent(new CustomEvent('open-auth', { detail: mode }));
}

export async function signOutUser() {
  const { getAuth, signOut } = await import('firebase/auth');
  await signOut(getAuth(getFirebaseApp()!));
}

export function setEditMode(on: boolean) {
  storage.set(EDIT_KEY, on ? '1' : null);
  set({ editMode: on && isStaff(state.role) });
}

const SERVER_STATE = state;
export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );
}
