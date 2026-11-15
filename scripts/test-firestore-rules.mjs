// Ejecutar desde la raíz del repo:
//   firebase emulators:exec --only firestore --project demo-test "node scripts/test-firestore-rules.mjs"
// Pruebas de reglas contra el emulador de Firestore (tokens sin firmar, aceptados solo por el emulador)
const P = 'demo-test', B = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const tok = (uid) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: uid, user_id: uid, aud: P, iss: `https://securetoken.google.com/${P}`, iat: 1, exp: 9999999999, firebase: { sign_in_provider: 'google.com' } })}.`; };
const val = (v) => typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } } : { stringValue: v };
const enc = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
async function req(method, path, uid, body, mask) {
  const h = { 'Content-Type': 'application/json' }; if (uid) h.Authorization = 'Bearer ' + tok(uid);
  const q = mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + m).join('&') : '';
  const r = await fetch(B + path + q, { method, headers: h, body: body ? JSON.stringify(enc(body)) : undefined }); return r.status;
}
// Semilla con privilegios de admin del emulador
async function seed(path, body) { await fetch(B + path, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(enc(body)) }); }
const now = '2026-11-15T00:00:00Z';
const OWNER = 'x8d0hCPRy0bNgwHeub4C7ZB7K2q2'; // debe coincidir con ownerUid() de firestore.rules
const u = (role) => ({ email: 'x@x.com', name: 'X', photoURL: '', role, createdAt: now, lastLogin: now });
await seed(`/users/${OWNER}`, u('user')); // en la BD figura como "user": el rol owner lo da su UID
await seed('/users/bob', u('user'));
await seed('/users/ana', u('premium'));
await seed('/users/bad', u('blocked'));
await seed('/users/fakeowner', u('user'));
await seed('/profiles/ana', { isPublic: true, profile: 'cv' });
await seed('/profiles/bob', { isPublic: true, profile: 'cv' });
await seed('/settings/plans', { premiumPrice: 'USD 5' });
const reqBody = (uid, extra = {}) => ({ uid, email: 'x@x.com', name: 'X', requestedRole: 'premium', message: 'hola', paymentRef: '', status: 'pending', createdAt: now, ...extra });
const P0 = { profile: 'p', contact: 'c', experience: ['a', 'b'], education: ['e'], skills: [], projects: [], languages: [], hobbies: [], cv: 'cv', bot: 'bot' };
await seed('/portfolio/main', P0);
await seed('/users/carla', { ...u('editor'), permissions: { experience: 'edit', education: 'create', messages: 'view' } });
await seed('/users/dani', { ...u('editor'), permissions: { pdf: 'edit' } });
const tests = [
  // Permisos por sección (editores)
  ['Editor con "edit" modifica una experiencia', 200, () => req('PATCH', '/portfolio/main', 'carla', { ...P0, experience: ['a2', 'b'] })],
  ['Editor con "edit" NO agrega experiencias', 403, () => req('PATCH', '/portfolio/main', 'carla', { ...P0, experience: ['a', 'b', 'nueva'] })],
  ['Editor con "edit" NO elimina experiencias', 403, () => req('PATCH', '/portfolio/main', 'carla', { ...P0, experience: ['a'] })],
  ['Editor con "create" agrega estudios', 200, () => req('PATCH', '/portfolio/main', 'carla', { ...P0, education: ['e', 'nuevo'] })],
  ['Editor sin permiso NO toca el contacto', 403, () => req('PATCH', '/portfolio/main', 'carla', { ...P0, contact: 'hack' })],
  ['Editor sin permiso NO cambia el diseño del CV', 403, () => req('PATCH', '/portfolio/main', 'carla', { ...P0, cv: 'hack' })],
  ['Editor con "view" en mensajes los lee', 200, () => req('GET', '/messages', 'carla')],
  ['Editor sin permiso NO lee mensajes', 403, () => req('GET', '/messages', 'dani')],
  ['Editor con permiso "pdf" publica el PDF', 200, () => req('PATCH', '/cvPdf/current', 'dani', { fileName: 'cv.pdf' })],
  ['Editor sin permiso "pdf" NO publica el PDF', 403, () => req('PATCH', '/cvPdf/current', 'carla', { fileName: 'cv.pdf' })],
  ['Editor NO se cambia sus propios permisos', 403, () => req('PATCH', '/users/carla', 'carla', { permissions: { contact: 'create' } }, ['permissions'])],
  ['Administrador asigna permisos a un editor', 200, () => req('PATCH', '/users/carla', OWNER, { permissions: { contact: 'edit' } }, ['permissions'])],

  // Registro y roles
  ['Nuevo usuario se registra como user', 200, () => req('PATCH', '/users/alice', 'alice', u('user'))],
  ['Nuevo usuario NO puede registrarse como editor', 403, () => req('PATCH', '/users/eve', 'eve', u('editor'))],
  ['Usuario NO puede subirse el rol', 403, () => req('PATCH', '/users/bob', 'bob', { role: 'editor' }, ['role'])],
  ['Usuario actualiza su último acceso', 200, () => req('PATCH', '/users/bob', 'bob', { lastLogin: '2026-11-16' }, ['lastLogin'])],
  ['Usuario NO lee a otros usuarios', 403, () => req('GET', `/users/${OWNER}`, 'bob')],
  ['Usuario NO lista usuarios', 403, () => req('GET', '/users', 'bob')],
  ['Administrador (por UID) lista usuarios', 200, () => req('GET', '/users', OWNER)],
  ['Administrador asigna editor a bob', 200, () => req('PATCH', '/users/bob', OWNER, { role: 'editor' }, ['role'])],
  ['Administrador NO puede asignar el rol owner', 403, () => req('PATCH', '/users/fakeowner', OWNER, { role: 'owner' }, ['role'])],
  ['Un "owner" escrito en la BD NO da poderes', 403, async () => { await seed('/users/fakeowner', u('owner')); return req('GET', '/users', 'fakeowner'); }],
  ['Editor (bob) NO asigna roles', 403, () => req('PATCH', '/users/alice', 'bob', { role: 'premium' }, ['role'])],
  ['Editor sin permisos NO edita el portafolio', 403, () => req('PATCH', '/portfolio/main', 'bob', { ...P0, profile: 'x' })],
  ['Administrador edita el portafolio', 200, () => req('PATCH', '/portfolio/main', OWNER, { ...P0, profile: 'x' })],
  ['Usuario NO edita el portafolio', 403, () => req('PATCH', '/portfolio/main', 'alice', { ...P0, profile: 'y' })],
  // Solicitudes de permiso
  ['Usuario solicita permiso premium', 200, () => req('PATCH', '/roleRequests/alice', 'alice', reqBody('alice'))],
  ['Usuario NO se autoaprueba la solicitud', 403, () => req('PATCH', '/roleRequests/alice', 'alice', reqBody('alice', { status: 'approved' }))],
  ['Usuario NO pide un rol owner', 403, () => req('PATCH', '/roleRequests/alice', 'alice', reqBody('alice', { requestedRole: 'owner' }))],
  ['Usuario NO lee solicitudes ajenas', 403, () => req('GET', '/roleRequests/alice', 'bob')],
  ['Administrador lista solicitudes', 200, () => req('GET', '/roleRequests', OWNER)],
  ['Administrador aprueba la solicitud', 200, () => req('PATCH', '/roleRequests/alice', OWNER, { status: 'approved', reviewedAt: now }, ['status', 'reviewedAt'])],
  ['Bloqueado NO puede solicitar permisos', 403, () => req('PATCH', '/roleRequests/bad', 'bad', reqBody('bad'))],
  // CV personales
  ['Usuario guarda su propio CV', 200, () => req('PATCH', '/profiles/alice', 'alice', { profile: 'cv' })],
  ['Usuario NO lee el CV privado de otro', 403, () => req('GET', '/profiles/alice', 'bad')],
  ['Usuario NO escribe el CV de otro', 403, () => req('PATCH', '/profiles/alice', 'bad', { profile: 'hack' })],
  ['Administrador lee cualquier CV', 200, () => req('GET', '/profiles/alice', OWNER)],
  ['Bloqueado NO guarda su CV', 403, () => req('PATCH', '/profiles/bad', 'bad', { profile: 'x' })],
  ['Anónimo ve el CV público de un premium', 200, () => req('GET', '/profiles/ana')],
  ['Anónimo NO ve un CV "público" de un user normal', 403, () => req('GET', '/profiles/alice')],
  // Configuración y otros
  ['Anónimo lee los planes', 200, () => req('GET', '/settings/plans')],
  ['Editor NO cambia los planes', 403, () => req('PATCH', '/settings/plans', 'bob', { paymentLink: 'https://evil' })],
  ['Administrador cambia los planes', 200, () => req('PATCH', '/settings/plans', OWNER, { paymentLink: 'https://pay' })],
  ['Anónimo lee el portafolio', 200, () => req('GET', '/portfolio/main')],
  ['Anónimo NO lee mensajes', 403, () => req('GET', '/messages')],
];
let fail = 0;
for (const [name, want, fn] of tests) { const got = await fn(); const ok = got === want; if (!ok) fail++; console.log(`${ok ? '✔' : '✘'} ${name} (esperado ${want}, obtenido ${got})`); }
console.log(fail ? `${fail} FALLARON` : 'TODAS LAS PRUEBAS PASARON'); process.exit(fail ? 1 : 0);
