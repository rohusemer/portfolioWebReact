import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, limit, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore/lite';
import type { ContactMessage, CvPdfMeta, PortfolioData } from './types';
import seed from '../data/portfolio.json';

const config = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

export const seedData = seed as PortfolioData;

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured) return null;
  return getApps()[0] ?? initializeApp(config);
}

const PORTFOLIO_DOC = ['portfolio', 'main'] as const;

/** Combina lo guardado con la semilla para que campos nuevos nunca queden undefined. */
export function withDefaults(data: Partial<PortfolioData> | undefined, base: PortfolioData = seedData): PortfolioData {
  if (!data) return structuredClone(base);
  const seedData = base;
  return {
    ...seedData,
    ...data,
    profile: { ...seedData.profile, ...data.profile },
    contact: { ...seedData.contact, ...data.contact },
    cv: {
      ...seedData.cv,
      ...data.cv,
      layout: data.cv?.layout ?? seedData.cv.layout,
      titles: data.cv?.titles ?? {},
      custom: data.cv?.custom ?? [],
    },
    bot: { ...seedData.bot, ...data.bot },
  };
}

/** Lee el portafolio publicado. Devuelve null si no existe o Firebase no está configurado. */
export async function fetchPortfolio(): Promise<PortfolioData | null> {
  const app = getFirebaseApp();
  if (!app) return null;
  const snap = await getDoc(doc(getFirestore(app), ...PORTFOLIO_DOC));
  return snap.exists() ? withDefaults(snap.data() as PortfolioData) : null;
}

let cached: Promise<PortfolioData | null> | null = null;
/** Igual que fetchPortfolio pero compartido por todas las islas de la página (una sola lectura). */
export function loadPortfolioOnce(): Promise<PortfolioData | null> {
  return (cached ??= fetchPortfolio().catch((err) => {
    console.warn('No se pudo cargar el portafolio desde Firebase:', err);
    return null;
  }));
}

export async function savePortfolio(data: PortfolioData): Promise<void> {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase no está configurado');
  const payload = JSON.parse(JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
  await setDoc(doc(getFirestore(app), ...PORTFOLIO_DOC), payload);
}

// ---------- Usuarios y roles ----------
//  owner   → todo, incluida la gestión de usuarios
//  editor  → edita el portafolio principal, publica el PDF y lee mensajes
//  user    → solo su propio CV (/mi-cv)
//  blocked → sin acceso

export type Role = 'owner' | 'editor' | 'user' | 'blocked';
export const ROLES: Role[] = ['owner', 'editor', 'user', 'blocked'];
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  editor: 'Editor',
  user: 'Usuario',
  blocked: 'Bloqueado',
};
/** Puede editar el portafolio principal y entrar a /admin. */
export const isStaff = (role: Role | null | undefined) => role === 'owner' || role === 'editor';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: Role;
  createdAt: string;
  lastLogin: string;
}

/**
 * Registra al usuario la primera vez que entra (rol "user") y actualiza su
 * último acceso en las siguientes. Devuelve su rol actual.
 */
export async function ensureUserProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<Role> {
  const ref = doc(db(), 'users', user.uid);
  const now = new Date().toISOString();
  const basics = { email: user.email ?? '', name: user.displayName ?? '', photoURL: user.photoURL ?? '', lastLogin: now };
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { ...basics, role: 'user', createdAt: now });
    return 'user';
  }
  await updateDoc(ref, basics).catch(() => {});
  return (snap.data().role as Role) ?? 'user';
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db(), 'users'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<AppUser, 'uid'>) }));
}

export const setUserRole = (uid: string, role: Role) => updateDoc(doc(db(), 'users', uid), { role });

// ---------- CV personal de cada usuario (profiles/{uid}) ----------

export async function fetchProfile(uid: string): Promise<PortfolioData | null> {
  const snap = await getDoc(doc(db(), 'profiles', uid));
  return snap.exists() ? withDefaults(snap.data() as PortfolioData, blankProfile()) : null;
}

export async function saveProfile(uid: string, data: PortfolioData): Promise<void> {
  await setDoc(doc(db(), 'profiles', uid), JSON.parse(JSON.stringify({ ...data, updatedAt: new Date().toISOString() })));
}

/** Plantilla vacía para un usuario nuevo, con lo que ya sabemos de su cuenta de Google. */
export function blankProfile(user?: { displayName: string | null; email: string | null; photoURL: string | null }): PortfolioData {
  return {
    profile: {
      name: user?.displayName ?? '',
      title: 'Tu título profesional',
      photoUrl: user?.photoURL ?? '',
      summary: 'Escribe aquí un resumen breve de tu perfil profesional.',
      about: '',
    },
    contact: { phone: '', email: user?.email ?? '', linkedin: '', github: '', location: '' },
    skills: [],
    experience: [],
    education: [],
    projects: [],
    languages: [],
    hobbies: [],
    cv: structuredClone(seedData.cv),
    bot: { name: '', greeting: '', faqs: [] },
  };
}

// ---------- Mensajes de contacto (bot) ----------

const db = () => {
  const app = getFirebaseApp();
  if (!app) throw new Error('Firebase no está configurado');
  return getFirestore(app);
};

export async function sendContactMessage(msg: Pick<ContactMessage, 'name' | 'email' | 'company' | 'message'>) {
  await addDoc(collection(db(), 'messages'), {
    name: msg.name.trim().slice(0, 100),
    email: msg.email.trim().slice(0, 150),
    company: msg.company.trim().slice(0, 100),
    message: msg.message.trim().slice(0, 2000),
    createdAt: new Date().toISOString(),
    read: false,
  });
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const snap = await getDocs(query(collection(db(), 'messages'), orderBy('createdAt', 'desc'), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContactMessage, 'id'>) }));
}

export const markMessageRead = (id: string, read: boolean) => updateDoc(doc(db(), 'messages', id), { read });
export const deleteContactMessage = (id: string) => deleteDoc(doc(db(), 'messages', id));

// ---------- PDF del CV publicado (lo entrega el bot) ----------
// Firebase Storage requiere plan de pago, así que el PDF se guarda en Firestore
// como base64 dividido en trozos (cada documento admite hasta 1 MB).

const CHUNK_SIZE = 700_000;

export async function publishCvPdf(base64: string, fileName: string): Promise<CvPdfMeta> {
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) chunks.push(base64.slice(i, i + CHUNK_SIZE));
  const batch = writeBatch(db());
  chunks.forEach((data, i) => batch.set(doc(db(), 'cvPdf', 'current', 'chunks', String(i)), { data }));
  const meta: CvPdfMeta = {
    fileName,
    publishedAt: new Date().toISOString(),
    chunks: chunks.length,
    size: Math.round((base64.length * 3) / 4),
  };
  batch.set(doc(db(), 'cvPdf', 'current'), meta);
  await batch.commit();
  return meta;
}

export async function fetchCvPdfMeta(): Promise<CvPdfMeta | null> {
  if (!firebaseConfigured) return null;
  try {
    const snap = await getDoc(doc(db(), 'cvPdf', 'current'));
    return snap.exists() ? (snap.data() as CvPdfMeta) : null;
  } catch {
    return null;
  }
}

/** Descarga el PDF publicado. Devuelve false si todavía no hay ninguno. */
export async function downloadPublishedCv(): Promise<boolean> {
  const meta = await fetchCvPdfMeta();
  if (!meta) return false;
  const parts = await Promise.all(
    Array.from({ length: meta.chunks }, (_, i) => getDoc(doc(db(), 'cvPdf', 'current', 'chunks', String(i)))),
  );
  const binary = atob(parts.map((p) => p.data()?.data ?? '').join(''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: meta.fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
