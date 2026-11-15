// Ejecutar desde la raíz del repo:
//   firebase emulators:exec --only firestore --project demo-test "node scripts/test-firestore-rules.mjs"
// Pruebas de reglas contra el emulador de Firestore (tokens sin firmar, aceptados solo por el emulador)
const P = 'demo-test', B = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const tok = (uid) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); return `${b({ alg: 'none', typ: 'JWT' })}.${b({ sub: uid, user_id: uid, aud: P, iss: `https://securetoken.google.com/${P}`, iat: 1, exp: 9999999999, firebase: { sign_in_provider: 'google.com' } })}.`; };
const enc = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: v }])) });
async function req(method, path, uid, body, mask) {
  const h = { 'Content-Type': 'application/json' }; if (uid) h.Authorization = 'Bearer ' + tok(uid);
  const q = mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + m).join('&') : '';
  const r = await fetch(B + path + q, { method, headers: h, body: body ? JSON.stringify(enc(body)) : undefined }); return r.status;
}
// Semilla con privilegios de admin del emulador
async function seed(path, body) { await fetch(B + path, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(enc(body)) }); }
const now = '2026-11-15T00:00:00Z';
await seed('/users/owner1', { email: 'o@x.com', name: 'O', photoURL: '', role: 'owner', createdAt: now, lastLogin: now });
await seed('/users/bob', { email: 'b@x.com', name: 'B', photoURL: '', role: 'user', createdAt: now, lastLogin: now });
await seed('/users/bad', { email: 'z@x.com', name: 'Z', photoURL: '', role: 'blocked', createdAt: now, lastLogin: now });
const tests = [
  ['Nuevo usuario se registra como user', 200, () => req('PATCH', '/users/alice', 'alice', { email: 'a@x.com', name: 'A', photoURL: '', role: 'user', createdAt: now, lastLogin: now })],
  ['Nuevo usuario NO puede registrarse como owner', 403, () => req('PATCH', '/users/eve', 'eve', { email: 'e@x.com', name: 'E', photoURL: '', role: 'owner', createdAt: now, lastLogin: now })],
  ['Usuario NO puede subirse el rol', 403, () => req('PATCH', '/users/bob', 'bob', { role: 'owner' }, ['role'])],
  ['Usuario actualiza su último acceso', 200, () => req('PATCH', '/users/bob', 'bob', { lastLogin: '2026-11-16' }, ['lastLogin'])],
  ['Usuario NO lee a otros usuarios', 403, () => req('GET', '/users/owner1', 'bob')],
  ['Usuario NO lista usuarios', 403, () => req('GET', '/users', 'bob')],
  ['Owner lista usuarios', 200, () => req('GET', '/users', 'owner1')],
  ['Owner cambia rol de bob a editor', 200, () => req('PATCH', '/users/bob', 'owner1', { role: 'editor' }, ['role'])],
  ['Owner NO puede poner un rol inventado', 403, () => req('PATCH', '/users/bob', 'owner1', { role: 'superadmin' }, ['role'])],
  ['Editor (bob) edita el portafolio', 200, () => req('PATCH', '/portfolio/main', 'bob', { profile: 'x', experience: 'x', education: 'x' })],
  ['Editor NO lista usuarios', 403, () => req('GET', '/users', 'bob')],
  ['User (alice) NO edita el portafolio', 403, () => req('PATCH', '/portfolio/main', 'alice', { profile: 'x', experience: 'x', education: 'x' })],
  ['User guarda su propio CV', 200, () => req('PATCH', '/profiles/alice', 'alice', { profile: 'cv' })],
  ['User lee su propio CV', 200, () => req('GET', '/profiles/alice', 'alice')],
  ['User NO lee el CV de otro', 403, () => req('GET', '/profiles/alice', 'bob')],
  ['User NO escribe el CV de otro', 403, () => req('PATCH', '/profiles/alice', 'bob', { profile: 'hack' })],
  ['Owner lee el CV de un usuario', 200, () => req('GET', '/profiles/alice', 'owner1')],
  ['Bloqueado NO guarda su CV', 403, () => req('PATCH', '/profiles/bad', 'bad', { profile: 'x' })],
  ['Anónimo lee el portafolio', 200, () => req('GET', '/portfolio/main')],
  ['Anónimo NO lee mensajes', 403, () => req('GET', '/messages')],
];
let fail = 0;
for (const [name, want, fn] of tests) { const got = await fn(); const ok = got === want; if (!ok) fail++; console.log(`${ok ? '✔' : '✘'} ${name} (esperado ${want}, obtenido ${got})`); }
console.log(fail ? `${fail} FALLARON` : 'TODAS LAS PRUEBAS PASARON'); process.exit(fail ? 1 : 0);
