import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, getDocs, query, orderBy, limit, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore/lite';
import { newId, type ContactMessage, type CvPdfMeta, type PortfolioData } from './types';
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
//  owner   → el administrador: único con acceso al panel y a la edición del portafolio.
//            Fijo por UID (no se asigna ni se quita).
//  premium → su CV + página pública compartible (permiso especial / de pago)
//  user    → su propio CV (/mi-cv). Rol por defecto al registrarse.
//  blocked → sin acceso

export type Role = 'owner' | 'premium' | 'user' | 'blocked';
/** Roles que el administrador puede asignar (owner no se asigna: es fijo). */
export const ASSIGNABLE_ROLES: Role[] = ['premium', 'user', 'blocked'];
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Administrador',
  premium: 'Premium',
  user: 'Usuario',
  blocked: 'Bloqueado',
};

/**
 * UID del administrador. Debe coincidir con ownerUid() de firestore.rules,
 * que es lo que realmente lo protege (el cliente solo lo usa para la interfaz).
 */
export const OWNER_UID = import.meta.env.PUBLIC_OWNER_UID ?? '';

/** Solo el administrador entra al panel y edita el portafolio. */
export const isStaff = (role: Role | null | undefined) => role === 'owner';
/** Puede publicar su CV en una página pública. */
export const canPublishProfile = (role: Role | null | undefined) => role === 'owner' || role === 'premium';

// ---------- Permisos por sección del CV de cada usuario ----------
// El administrador decide qué puede hacer cada usuario en SU PROPIO CV (/mi-cv):
//   none   → no ve la sección
//   view   → la ve, solo lectura
//   edit   → modifica lo existente (no agrega ni elimina elementos)
//   create → control total: edita, agrega y elimina
// Por defecto un usuario nuevo puede VER y EDITAR (no agregar ni eliminar); descargar su PDF está permitido.
// Las reglas de Firestore aplican estos mismos permisos en el servidor.

export type PermLevel = 'none' | 'view' | 'edit' | 'create';
export const PERM_LEVELS: PermLevel[] = ['none', 'view', 'edit', 'create'];
export const PERM_LABELS: Record<PermLevel, string> = { none: 'Sin acceso', view: 'Ver', edit: 'Editar', create: 'Crear y eliminar' };

/** Secciones con permisos. Las claves coinciden con los campos del documento profiles/{uid}. */
export const PERM_SECTIONS = [
  { key: 'profile', label: 'Perfil (nombre, foto, resumen)', group: 'Información' },
  { key: 'contact', label: 'Contacto', group: 'Información' },
  { key: 'experience', label: 'Experiencia', group: 'Información' },
  { key: 'education', label: 'Estudios', group: 'Información' },
  { key: 'skills', label: 'Habilidades', group: 'Información' },
  { key: 'projects', label: 'Proyectos', group: 'Información' },
  { key: 'languages', label: 'Idiomas', group: 'Información' },
  { key: 'hobbies', label: 'Hobbies', group: 'Información' },
  { key: 'cv', label: 'Diseño del CV (constructor)', group: 'CV' },
  { key: 'pdf', label: 'Descargar su CV en PDF', group: 'CV' },
] as const;
export type PermSection = (typeof PERM_SECTIONS)[number]['key'] | 'bot' | 'messages';
export type Permissions = Partial<Record<PermSection, PermLevel>>;

const LEVEL_RANK: Record<PermLevel, number> = { none: 0, view: 1, edit: 2, create: 3 };

/** Nivel por defecto de un usuario nuevo: ver y editar. */
export const DEFAULT_LEVEL: PermLevel = 'edit';

/** Nivel efectivo de un usuario en una sección de su CV. */
export const levelIn = (perms: Permissions | undefined, section: PermSection): PermLevel => perms?.[section] ?? DEFAULT_LEVEL;

/** ¿Alcanza el nivel `need`? */
export const atLeast = (level: PermLevel, need: PermLevel) => LEVEL_RANK[level] >= LEVEL_RANK[need];

/** Compatibilidad: el administrador puede todo en el panel. */
export function can(role: Role | null | undefined, _perms: Permissions | undefined, _section: PermSection, _need: PermLevel): boolean {
  return role === 'owner';
}

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: Role;
  username?: string;
  provider?: string;
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
export async function ensureUserAccess(user: AuthUserLike): Promise<UserAccess> {
  const role = await ensureUserProfile(user);
  if (role === 'owner') return { role, permissions: {} };
  const snap = await getDoc(doc(db(), 'users', user.uid));
  return { role, permissions: (snap.data()?.permissions as Permissions) ?? {} };
}

type AuthUserLike = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerData?: { providerId: string }[];
};

export async function ensureUserProfile(user: AuthUserLike): Promise<Role> {
  const ref = doc(db(), 'users', user.uid);
  const now = new Date().toISOString();
  const provider = user.providerData?.[0]?.providerId ?? 'password';
  const basics = { email: user.email ?? '', name: user.displayName ?? '', photoURL: user.photoURL ?? '', provider, lastLogin: now };
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Si otra pestaña/listener lo creó en paralelo, la creación falla: basta con actualizar
    await setDoc(ref, { ...basics, role: 'user', createdAt: now }).catch(() => updateDoc(ref, basics).catch(() => {}));
  } else await updateDoc(ref, basics).catch(() => {});
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

export const setUserRole = (uid: string, role: Role) => updateDoc(doc(db(), 'users', uid), { role });

// ---------- Nombres de usuario (únicos) ----------
// usernames/{nombre} → { uid }. Se reserva en la misma operación que se guarda
// en users/{uid}.username, y las reglas garantizan que no se repita.

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])$/;
const RESERVED = new Set(['admin', 'administrador', 'root', 'soporte', 'support', 'sure', 'suredevelopments', 'ronny', 'perfil', 'cv', 'api']);

/** Normaliza y valida. Devuelve un mensaje de error o null si es válido. */
export function usernameIssue(name: string): string | null {
  if (!USERNAME_RE.test(name)) return 'De 3 a 20 caracteres: letras minúsculas, números, punto o guion bajo (sin empezar ni terminar con ellos).';
  if (RESERVED.has(name)) return 'Ese nombre está reservado.';
  return null;
}

export async function isUsernameAvailable(name: string): Promise<boolean> {
  const snap = await getDoc(doc(db(), 'usernames', name));
  return !snap.exists();
}

/** Reserva el nombre y lo asigna al usuario (atómico). Falla si ya está tomado. */
export async function claimUsername(uid: string, name: string) {
  const batch = writeBatch(db());
  batch.set(doc(db(), 'usernames', name), { uid, createdAt: new Date().toISOString() });
  batch.update(doc(db(), 'users', uid), { username: name });
  await batch.commit();
}

export async function fetchMyUsername(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), 'users', uid));
  return (snap.data()?.username as string) ?? null;
}

/** Convierte un nombre de usuario en UID (para /perfil?u=nombre). */
export async function resolveUsername(name: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), 'usernames', name.toLowerCase()));
  return snap.exists() ? (snap.data().uid as string) : null;
}

/**
 * Elimina los datos de un usuario (ficha, CV y solicitud). La cuenta de acceso
 * de Firebase Auth solo se puede borrar desde un servidor (Admin SDK); si la
 * persona vuelve a entrar se registrará como usuaria nueva. Para impedir el
 * acceso de forma permanente, usa el rol "Bloqueado".
 */
export async function deleteUserData(uid: string, username?: string) {
  const batch = writeBatch(db());
  if (username) batch.delete(doc(db(), 'usernames', username));
  batch.delete(doc(db(), 'profiles', uid));
  batch.delete(doc(db(), 'roleRequests', uid));
  batch.delete(doc(db(), 'users', uid));
  await batch.commit();
}

/** Envía al usuario el correo de Firebase para restablecer su contraseña. */
export async function sendPasswordReset(email: string) {
  const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(getAuth(getFirebaseApp()!), email);
}

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
export function blankProfile(user?: { displayName: string | null; email: string | null; photoURL: string | null }, photo?: string): PortfolioData {
  const L = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
  return {
    profile: {
      name: user?.displayName || 'Tu Nombre',
      title: 'Tu título profesional',
      photoUrl: photo || user?.photoURL || '',
      summary: `**Lorem ipsum** dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
      about: `¡Hola! ${L} Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.`,
    },
    contact: { phone: '000 000 0000', email: user?.email ?? 'tu@correo.com', linkedin: 'https://www.linkedin.com/in/tu-usuario', github: 'https://github.com/tu-usuario', location: 'Ciudad, País' },
    skills: [
      { id: newId(), category: 'Lorem', items: 'Ipsum, Dolor, Sit, Amet' },
      { id: newId(), category: 'Consectetur', items: 'Adipiscing, Elit, Sed, Do' },
    ],
    experience: [
      { id: newId(), company: 'Empresa Lorem S.A.', role: 'Cargo Ipsum', start: '01/2023', end: 'actual', description: `- ${L}\n- Sed do eiusmod tempor incididunt ut labore.` },
      { id: newId(), company: 'Dolor Sit Amet', role: 'Cargo Consectetur', start: '01/2021', end: '12/2022', description: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.' },
    ],
    education: [
      { id: newId(), title: 'Título Lorem Ipsum', kind: 'Título', institution: 'Universidad Dolor Sit', description: '' },
      { id: newId(), title: 'Curso Consectetur', kind: 'Curso', institution: 'Institución Amet', description: '' },
    ],
    projects: [{ id: newId(), name: 'Proyecto Lorem', url: '', description: 'Duis aute irure dolor in reprehenderit in voluptate velit esse.' }],
    languages: [
      { id: newId(), name: 'Español', level: 'Nativo' },
      { id: newId(), name: 'Inglés', level: 'Intermedio' },
    ],
    hobbies: ['Lorem ipsum', 'Dolor sit amet'],
    cv: { accentColor: '#5b8ec4', layout: structuredClone(seedData.cv.layout), titles: {}, custom: [] },
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
  requestedRole: 'premium';
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
export async function fetchPublicProfile(idOrUsername: string): Promise<PortfolioData | null> {
  if (!firebaseConfigured) return null;
  const uid = (await resolveUsername(idOrUsername).catch(() => null)) ?? idOrUsername;
  const snap = await getDoc(doc(db(), 'profiles', uid));
  return snap.exists() ? withDefaults(snap.data() as PortfolioData, blankProfile()) : null;
}
