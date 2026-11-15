// Ejecutar desde la raíz del repo:
//   firebase emulators:exec --only firestore --project demo-test "node scripts/test-firestore-rules.mjs"
// Pruebas de reglas contra el emulador de Firestore (tokens sin firmar, aceptados solo por el emulador)
const P = 'demo-test', B = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const tok = (uid, verified = true) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: uid, user_id: uid, aud: P, iss: `https://securetoken.google.com/${P}`, iat: 1, exp: 9999999999, email_verified: verified, firebase: { sign_in_provider: verified ? 'google.com' : 'password' } })}.`; };
const val = (v) => typeof v === 'boolean' ? { booleanValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } } : { stringValue: v };
const enc = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
async function req(method, path, uid, body, mask, verified = true) {
  const h = { 'Content-Type': 'application/json' }; if (uid) h.Authorization = 'Bearer ' + tok(uid, verified);
  const q = mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + m).join('&') : '';
  const r = await fetch(B + path + q, { method, headers: h, body: body ? JSON.stringify(enc(body)) : undefined }); return r.status;
}
async function commit(uid, writes) {
  const r = await fetch(B.replace('/documents', '/documents:commit'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok(uid) }, body: JSON.stringify({ writes }) });
  return r.status;
}
const claim = (uid, name) => commit(uid, [
  { update: { name: `projects/${P}/databases/(default)/documents/usernames/${name}`, ...enc({ uid, createdAt: '2026-11-15' }) } },
  { update: { name: `projects/${P}/databases/(default)/documents/users/${uid}`, ...enc({ username: name }) }, updateMask: { fieldPaths: ['username'] } },
]);
// Semilla con privilegios de admin del emulador
async function seed(path, body) { await fetch(B + path, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(enc(body)) }); }
const now = '2026-11-15T00:00:00Z';
const OWNER = 'x8d0hCPRy0bNgwHeub4C7ZB7K2q2'; // debe coincidir con ownerUid() de firestore.rules
const u = (role, extra = {}) => ({ email: 'x@x.com', name: 'X', photoURL: '', provider: 'password', role, createdAt: now, lastLogin: now, ...extra });
const CV = { profile: 'p', contact: 'c', experience: ['a', 'b'], education: ['e'], skills: [], projects: [], languages: [], hobbies: [], cv: 'cv', bot: 'bot' };
await seed(`/users/${OWNER}`, u('user')); // en la BD figura como "user": el rol owner lo da su UID
await seed('/users/bob', u('user', { permissions: { experience: 'create' } }));
await seed('/users/dan', u('user'));
await seed('/users/nuevo', u('user'));
await seed('/users/eli', u('user', { permissions: { experience: 'create' } }));
await seed('/users/ana', u('premium'));
await seed('/users/bad', u('blocked'));
await seed('/users/fake', u('owner')); // alguien que logró escribir "owner" en su documento
await seed('/users/carla', u('user', { permissions: { experience: 'edit', education: 'create', contact: 'view', cv: 'none' } }));
await seed('/portfolio/main', CV);
await seed('/settings/plans', { premiumPrice: 'USD 5' });
await seed('/profiles/ana', { ...CV, isPublic: true });
await seed('/profiles/bob', { ...CV, isPublic: true });
await seed('/profiles/carla', CV);
await seed('/profiles/dan', CV);
await seed('/profiles/eli', CV);
await seed('/profiles/borrar', CV);
const reqBody = (uid, extra = {}) => ({ uid, email: 'x@x.com', name: 'X', requestedRole: 'premium', message: 'hola', paymentRef: '', status: 'pending', createdAt: now, ...extra });
const tests = [
  // Panel y portafolio: solo el administrador
  ['Administrador edita el portafolio', 200, () => req('PATCH', '/portfolio/main', OWNER, { ...CV, profile: 'x' })],
  ['Usuario NO edita el portafolio', 403, () => req('PATCH', '/portfolio/main', 'bob', { ...CV, profile: 'y' })],
  ['Premium NO edita el portafolio', 403, () => req('PATCH', '/portfolio/main', 'ana', { ...CV, profile: 'y' })],
  ['Un "owner" escrito en la BD NO edita el portafolio', 403, () => req('PATCH', '/portfolio/main', 'fake', { ...CV, profile: 'y' })],
  ['Un "owner" escrito en la BD NO lista usuarios', 403, () => req('GET', '/users', 'fake')],
  ['Usuario NO publica el PDF del bot', 403, () => req('PATCH', '/cvPdf/current', 'bob', { fileName: 'x.pdf' })],
  ['Administrador publica el PDF del bot', 200, () => req('PATCH', '/cvPdf/current', OWNER, { fileName: 'cv.pdf' })],
  ['Usuario NO lee mensajes', 403, () => req('GET', '/messages', 'ana')],
  ['Administrador lee mensajes', 200, () => req('GET', '/messages', OWNER)],
  // Registro y roles
  ['Nuevo usuario se registra como user', 200, () => req('PATCH', '/users/alice', 'alice', u('user'))],
  ['Nuevo usuario NO puede registrarse como premium', 403, () => req('PATCH', '/users/eve', 'eve', u('premium'))],
  ['Usuario NO puede subirse el rol', 403, () => req('PATCH', '/users/bob', 'bob', { role: 'premium' }, ['role'])],
  ['Usuario NO se cambia sus permisos', 403, () => req('PATCH', '/users/carla', 'carla', { permissions: { cv: 'create' } }, ['permissions'])],
  ['Usuario actualiza su último acceso', 200, () => req('PATCH', '/users/bob', 'bob', { lastLogin: '2026-11-16' }, ['lastLogin'])],
  ['Usuario NO lee a otros usuarios', 403, () => req('GET', `/users/${OWNER}`, 'bob')],
  ['Administrador lista usuarios', 200, () => req('GET', '/users', OWNER)],
  ['Administrador asigna premium', 200, () => req('PATCH', '/users/bob', OWNER, { role: 'premium' }, ['role'])],
  ['Administrador NO asigna el rol owner', 403, () => req('PATCH', '/users/bob', OWNER, { role: 'owner' }, ['role'])],
  ['Administrador asigna permisos por sección', 200, () => req('PATCH', '/users/bob', OWNER, { permissions: { cv: 'view' } }, ['permissions'])],
  // Permisos por sección en el CV propio
  ['Por defecto (ver/editar): modifica su experiencia', 200, () => req('PATCH', '/profiles/dan', 'dan', { ...CV, experience: ['x', 'b'] })],
  ['Por defecto (ver/editar): NO agrega experiencia', 403, () => req('PATCH', '/profiles/dan', 'dan', { ...CV, experience: ['a', 'b', 'c'] })],
  ['Correo SIN verificar NO edita su CV', 403, () => req('PATCH', '/profiles/dan', 'dan', { ...CV, profile: 'nuevo' }, undefined, false)],
  ['Correo SIN verificar SÍ crea su CV al registrarse', 200, () => req('PATCH', '/profiles/nuevo', 'nuevo', CV, undefined, false)],
  ['Usuario NO elimina el CV de otro', 403, () => req('DELETE', '/profiles/dan', 'eli')],
  ['Usuario NO elimina la ficha de otro', 403, () => req('DELETE', '/users/dan', 'eli')],
  ['Administrador NO puede ser eliminado', 403, () => req('DELETE', `/users/${OWNER}`, OWNER)],
  ['Administrador elimina el CV de un usuario', 200, () => req('DELETE', '/profiles/borrar', OWNER)],
  ['Administrador elimina un usuario', 200, () => req('DELETE', '/users/fake', OWNER)],
  ['Con permiso "create" agrega experiencia a su CV', 200, () => req('PATCH', '/profiles/eli', 'eli', { ...CV, experience: ['a', 'b', 'c'] })],
  ['Con "edit": modifica su experiencia', 200, () => req('PATCH', '/profiles/carla', 'carla', { ...CV, experience: ['a2', 'b'] })],
  ['Con "edit": NO agrega experiencia', 403, () => req('PATCH', '/profiles/carla', 'carla', { ...CV, experience: ['a', 'b', 'c'] })],
  ['Con "create": agrega estudios', 200, () => req('PATCH', '/profiles/carla', 'carla', { ...CV, education: ['e', 'f'] })],
  ['Con "view": NO modifica su contacto', 403, () => req('PATCH', '/profiles/carla', 'carla', { ...CV, contact: 'nuevo' })],
  ['Con "none": NO cambia el diseño del CV', 403, () => req('PATCH', '/profiles/carla', 'carla', { ...CV, cv: 'otro' })],
  ['Usuario NO escribe el CV de otro', 403, () => req('PATCH', '/profiles/carla', 'bob', { ...CV, profile: 'hack' })],
  ['Usuario NO lee el CV privado de otro', 403, () => req('GET', '/profiles/carla', 'bob')],
  ['Administrador lee cualquier CV', 200, () => req('GET', '/profiles/carla', OWNER)],
  ['Bloqueado NO guarda su CV', 403, () => req('PATCH', '/profiles/bad', 'bad', CV)],
  ['Anónimo ve el CV público de un premium', 200, () => req('GET', '/profiles/ana')],
  ['Anónimo NO ve un CV "público" de un user normal', 403, () => req('GET', '/profiles/carla')],
  // Nombres de usuario
  ['Usuario reserva su nombre de usuario', 200, () => claim('dan', 'dan.dev')],
  ['Otro usuario NO puede tomar el mismo nombre', 403, () => claim('eli', 'dan.dev')],
  ['NO puede cambiar su nombre una vez elegido', 403, () => claim('dan', 'otro.nombre')],
  ['NO puede reservar un nombre a nombre de otro', 403, () => commit('eli', [{ update: { name: `projects/${P}/databases/(default)/documents/usernames/robado`, ...enc({ uid: 'dan', createdAt: 'x' }) } }])],
  ['NO acepta nombres inválidos', 403, () => claim('eli', 'Mal Nombre!')],
  ['Cualquiera comprueba si un nombre existe', 200, () => req('GET', '/usernames/dan.dev')],
  ['Otro usuario NO libera un nombre ajeno', 403, () => req('DELETE', '/usernames/dan.dev', 'eli')],
  ['Usuario elimina su propia cuenta (nombre, CV y ficha)', 200, () => commit('dan', [
    { delete: `projects/${P}/databases/(default)/documents/usernames/dan.dev` },
    { delete: `projects/${P}/databases/(default)/documents/profiles/dan` },
    { delete: `projects/${P}/databases/(default)/documents/roleRequests/dan` },
    { delete: `projects/${P}/databases/(default)/documents/users/dan` },
  ])],
  // Solicitudes
  ['Usuario solicita Premium', 200, () => req('PATCH', '/roleRequests/alice', 'alice', reqBody('alice'))],
  ['Correo SIN verificar NO puede solicitar Premium', 403, () => req('PATCH', '/roleRequests/zoe', 'zoe', reqBody('zoe'), undefined, false)],
  ['Usuario NO se autoaprueba', 403, () => req('PATCH', '/roleRequests/alice', 'alice', reqBody('alice', { status: 'approved' }))],
  ['Usuario NO pide otro rol que Premium', 403, () => req('PATCH', '/roleRequests/alice', 'alice', reqBody('alice', { requestedRole: 'owner' }))],
  ['Administrador aprueba la solicitud', 200, () => req('PATCH', '/roleRequests/alice', OWNER, { status: 'approved', reviewedAt: now }, ['status', 'reviewedAt'])],
  // Mensajes y sugerencias
  ['Anónimo envía un mensaje de contacto válido', 200, () => req('POST', '/messages', null, { type: 'contact', name: 'Ana', email: 'ana@x.com', company: '', message: 'Hola', createdAt: now, read: false })],
  ['Contacto SIN correo es rechazado', 403, () => req('POST', '/messages', null, { type: 'contact', name: 'Ana', email: '', company: '', message: 'Hola', createdAt: now, read: false })],
  ['Sugerencia anónima (sin nombre ni correo)', 200, () => req('POST', '/messages', null, { type: 'suggestion', name: '', email: '', company: '', message: 'Agrega modo inglés', createdAt: now, read: false })],
  ['Sugerencia con correo inválido es rechazada', 403, () => req('POST', '/messages', null, { type: 'suggestion', name: '', email: 'no-es-correo', company: '', message: 'x', createdAt: now, read: false })],
  ['Mensaje de tipo inventado es rechazado', 403, () => req('POST', '/messages', null, { type: 'spam', name: 'x', email: 'a@b.co', company: '', message: 'x', createdAt: now, read: false })],
  // Configuración
  ['Anónimo lee los planes', 200, () => req('GET', '/settings/plans')],
  ['Usuario NO cambia los planes', 403, () => req('PATCH', '/settings/plans', 'ana', { paymentLink: 'https://evil' })],
  ['Anónimo lee el portafolio', 200, () => req('GET', '/portfolio/main')],
];
let fail = 0;
for (const [name, want, fn] of tests) { const got = await fn(); const ok = got === want; if (!ok) fail++; console.log(`${ok ? '✔' : '✘'} ${name} (esperado ${want}, obtenido ${got})`); }
console.log(fail ? `${fail} FALLARON` : 'TODAS LAS PRUEBAS PASARON'); process.exit(fail ? 1 : 0);
