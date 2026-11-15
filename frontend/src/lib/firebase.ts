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
//  owner   → el administrador principal (fijo por UID, no se puede asignar)
//  editor  → edita el portafolio principal, publica el PDF y lee mensajes
//  premium → su CV + página pública compartible (permiso especial / de pago)
//  user    → solo su propio CV (/mi-cv)
//  blocked → sin acceso

export type Role = 'owner' | 'editor' | 'premium' | 'user' | 'blocked';
/** Roles que el administrador puede asignar (owner no se asigna: es fijo). */
export const ASSIGNABLE_ROLES: Role[] = ['editor', 'premium', 'user', 'blocked'];
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Administrador',
  editor: 'Editor',
  premium: 'Premium',
  user: 'Usuario',
  blocked: 'Bloqueado',
};

/**
 * UID del administrador principal. Debe coincidir con OWNER_UID de firestore.rules,
 * que es lo que realmente lo protege (el cliente solo lo usa para mostrar la interfaz).
 */
export const OWNER_UID = import.meta.env.PUBLIC_OWNER_UID ?? '';

/** Puede editar el portafolio principal y entrar a /admin. */
export const isStaff = (role: Role | null | undefined) => role === 'owner' || role === 'editor';
/** Puede publicar su CV en una página pública. */
export const canPublishProfile = (role: Role | null | undefined) => role === 'owner' || role === 'editor' || role === 'premium';

// ---------- Permisos por sección (para editores) ----------
// El administrador decide, para cada editor, qué puede hacer en cada sección:
//   none   → no la ve
//   view   → la ve, solo lectura
//   edit   → modifica lo existente (no agrega ni elimina elementos)
//   create → control total: edita, agrega y elimina
// Las reglas de Firestore aplican estos mismos permisos en el servidor.

export type PermLevel = 'none' | 'view' | 'edit' | 'create';
export const PERM_LEVELS: PermLevel[] = ['none', 'view', 'edit', 'create'];
export const PERM_LABELS: Record<PermLevel, string> = { none: 'Sin acceso', view: 'Ver', edit: 'Editar', create: 'Crear y eliminar' };

/** Secciones con permisos. Las claves coinciden con los campos del documento portfolio/main. */
export const PERM_SECTIONS = [
  { key: 'profile', label: 'Perfil (nombre, foto, resumen)', group: 'Contenido' },
  { key: 'contact', label: 'Contacto', group: 'Contenido' },
  { key: 'experience', label: 'Experiencia', group: 'Contenido' },
  { key: 'education', label: 'Estudios', group: 'Contenido' },
  { key: 'skills', label: 'Habilidades', group: 'Contenido' },
  { key: 'projects', label: 'Proyectos', group: 'Contenido' },
  { key: 'languages', label: 'Idiomas', group: 'Contenido' },
  { key: 'hobbies', label: 'Hobbies', group: 'Contenido' },
  { key: 'cv', label: 'Diseño del CV (constructor)', group: 'CV y bot' },
  { key: 'bot', label: 'Bot asistente', group: 'CV y bot' },
  { key: 'pdf', label: 'Publicar el PDF del bot', group: 'CV y bot' },
  { key: 'messages', label: 'Mensajes de contacto', group: 'Otros' },
] as const;
export type PermSection = (typeof PERM_SECTIONS)[number]['key'];
export type Permissions = Partial<Record<PermSection, PermLevel>>;

/** Permisos por defecto al nombrar editor a alguien: puede ver todo, no cambia nada. */
export const DEFAULT_EDITOR_PERMS: Permissions = Object.fromEntries(PERM_SECTIONS.map((s) => [s.key, 'view'])) as Permissions;

const LEVEL_RANK: Record<PermLevel, number> = { none: 0, view: 1, edit: 2, create: 3 };

/** ¿El usuario tiene al menos `need` en la sección? El administrador siempre puede todo. */
export function can(role: Role | null | undefined, perms: Permissions | undefined, section: PermSection, need: PermLevel): boolean {
  if (role === 'owner') return true;
  if (role !== 'editor') return false;
  return LEVEL_RANK[perms?.[section] ?? 'none'] >= LEVEL_RANK[need];
}

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: Role;
  permissions?: Permissions;
  createdAt: string;
  lastLogin: string;
}

export interface UserAccess {
  role: Role;
  permissions: Permissions;
}

/**
 * Registra al usuario la primera vez que entra (rol "user") y actualiza su
 * último acceso en las siguientes. Devuelve su rol actual.
 */
export async function ensureUserAccess(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<UserAccess> {
  const role = await ensureUserProfile(user);
  if (role !== 'editor') return { role, permissions: {} };
  const snap = await getDoc(doc(db(), 'users', user.uid));
  return { role, permissions: (snap.data()?.permissions as Permissions) ?? {} };
}

export async function ensureUserProfile(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<Role> {
  const ref = doc(db(), 'users', user.uid);
  const now = new Date().toISOString();
  const basics = { email: user.email ?? '', name: user.displayName ?? '', photoURL: user.photoURL ?? '', lastLogin: now };
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { ...basics, role: 'user', createdAt: now });
  else await updateDoc(ref, basics).catch(() => {});
  if (OWNER_UID && user.uid === OWNER_UID) return 'owner';
  return snap.exists() ? ((snap.data().role as Role) ?? 'user') : 'user';
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db(), 'users'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const u = { uid: d.id, ...(d.data() as Omit<AppUser, 'uid'>) };
    return d.id === OWNER_UID ? { ...u, role: 'owner' as Role } : u;
  });
}

/** Cambia el rol. Al nombrar editor, si no tenía permisos, recibe los de solo lectura. */
export const setUserRole = (uid: string, role: Role, currentPerms?: Permissions) =>
  updateDoc(
    doc(db(), 'users', uid),
    role === 'editor' && !currentPerms ? { role, permissions: DEFAULT_EDITOR_PERMS } : { role },
  );

export const setUserPermissions = (uid: string, permissions: Permissions) => updateDoc(doc(db(), 'users', uid), { permissions });

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

// ---------- Planes y solicitudes de permiso especial ----------

export interface PlanSettings {
  premiumEnabled: boolean;
  premiumPrice: string; // texto libre: "USD 5 / pago único"
  paymentLink: string; // enlace de pago (PayPal, PayPhone, Stripe Payment Link…)
  perks: string; // markdown
  contactEmail: string;
}

export const DEFAULT_PLANS: PlanSettings = {
  premiumEnabled: true,
  premiumPrice: 'Gratis por ahora',
  paymentLink: '',
  perks: '- Página pública de tu CV para compartir con reclutadores\n- Enlace directo de descarga de tu CV en PDF\n- Soporte prioritario',
  contactEmail: seedData.contact.email,
};

export async function fetchPlans(): Promise<PlanSettings> {
  if (!firebaseConfigured) return DEFAULT_PLANS;
  try {
    const snap = await getDoc(doc(db(), 'settings', 'plans'));
    return { ...DEFAULT_PLANS, ...(snap.exists() ? (snap.data() as PlanSettings) : {}) };
  } catch {
    return DEFAULT_PLANS;
  }
}

export const savePlans = (p: PlanSettings) => setDoc(doc(db(), 'settings', 'plans'), p);

export type RequestStatus = 'pending' | 'approved' | 'rejected';
export interface RoleRequest {
  uid: string;
  email: string;
  name: string;
  requestedRole: 'premium' | 'editor';
  message: string;
  paymentRef: string;
  status: RequestStatus;
  createdAt: string;
  reviewedAt?: string;
}

export async function fetchMyRequest(uid: string): Promise<RoleRequest | null> {
  const snap = await getDoc(doc(db(), 'roleRequests', uid));
  return snap.exists() ? (snap.data() as RoleRequest) : null;
}

/** Crea o reemplaza la solicitud del usuario (siempre queda "pendiente"). */
export const submitRoleRequest = (r: Omit<RoleRequest, 'status' | 'createdAt' | 'reviewedAt'>) =>
  setDoc(doc(db(), 'roleRequests', r.uid), {
    ...r,
    message: r.message.slice(0, 1000),
    paymentRef: r.paymentRef.slice(0, 200),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

export async function listRoleRequests(): Promise<RoleRequest[]> {
  const snap = await getDocs(query(collection(db(), 'roleRequests'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as RoleRequest);
}

/** Aprueba (asigna el rol) o rechaza una solicitud, en una sola operación atómica. */
export async function reviewRoleRequest(r: RoleRequest, approve: boolean) {
  const batch = writeBatch(db());
  const reviewedAt = new Date().toISOString();
  batch.update(doc(db(), 'roleRequests', r.uid), { status: approve ? 'approved' : 'rejected', reviewedAt });
  if (approve) batch.update(doc(db(), 'users', r.uid), { role: r.requestedRole });
  await batch.commit();
}

// ---------- Página pública del CV (premium) ----------

/** Lee un CV publicado. Las reglas solo lo permiten si el dueño lo hizo público y tiene un rol que lo permite. */
export async function fetchPublicProfile(uid: string): Promise<PortfolioData | null> {
  if (!firebaseConfigured) return null;
  const snap = await getDoc(doc(db(), 'profiles', uid));
  return snap.exists() ? withDefaults(snap.data() as PortfolioData, blankProfile()) : null;
}
