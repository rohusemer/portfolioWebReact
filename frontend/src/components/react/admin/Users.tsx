import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ASSIGNABLE_ROLES,
  binaryOn,
  defaultLevel,
  deleteUserData,
  sendPasswordReset,
  downloadPublishedCv,
  fetchCvPdfMeta,
  fetchPortfolio,
  fetchProfile,
  listUsers,
  PERM_LABELS,
  PERM_LEVELS,
  PERM_SECTIONS,
  ROLE_LABELS,
  seedData,
  setUserPermissions,
  setUserRole,
  type AppUser,
  type PermLevel,
  type Permissions,
  type Role,
} from '../../../lib/firebase';
import RoleRequests from './RoleRequests';
import PlanSettingsCard from './PlanSettingsCard';
import type { CvPdfMeta, PortfolioData } from '../../../lib/types';
import { downloadCvPdf } from '../../../lib/cvPdf';
import { ScaledCv } from '../CvViewer';

const ROLE_STYLE: Record<Role, string> = {
  owner: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  premium: 'bg-violet-500/20 text-violet-700 dark:text-violet-400',
  user: 'bg-neutral-500/20',
  blocked: 'bg-red-500/20 text-red-600',
};

const ROLE_HELP: Record<Role, string> = {
  owner: 'Tú: control total (fijo, no se asigna)',
  premium: 'Su CV + página pública compartible',
  user: 'Solo su propio CV en /mi-cv',
  blocked: 'Sin acceso',
};

const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Gestión de usuarios registrados (solo propietarios). */
export default function Users({ currentUid }: { currentUid: string }) {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ user: AppUser; data: PortfolioData | null; main?: boolean } | null>(null);
  const [editingPerms, setEditingPerms] = useState<AppUser | null>(null);

  const load = () =>
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (u: AppUser, role: Role) => {
    if (role === u.role) return;
    if (role === 'blocked' && !confirm(`¿Bloquear a ${u.email}? No podrá editar ni descargar su CV.`)) return;
    setSaving(u.uid);
    try {
      await setUserRole(u.uid, role);
      setUsers((all) => all!.map((x) => (x.uid === u.uid ? { ...x, role } : x)));
    } catch (e) {
      alert(`No se pudo cambiar el rol: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  const removeUser = async (u: AppUser) => {
    const typed = prompt(
      `Vas a eliminar a ${u.email}: su ficha, su CV y sus solicitudes. Esta acción no se puede deshacer.\n\nEscribe ELIMINAR para confirmar:`,
    );
    if (typed?.trim().toUpperCase() !== 'ELIMINAR') return;
    setSaving(u.uid);
    try {
      await deleteUserData(u.uid, u.username);
      setUsers((all) => all!.filter((x) => x.uid !== u.uid));
    } catch (e) {
      alert(`No se pudo eliminar: ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  const resetPassword = async (u: AppUser) => {
    if (!confirm(`¿Enviar a ${u.email} un correo para restablecer su contraseña?`)) return;
    try {
      await sendPasswordReset(u.email);
      alert(`Listo: ${u.email} recibirá un enlace para crear una nueva contraseña.`);
    } catch (e) {
      alert(`No se pudo enviar: ${(e as Error).message}`);
    }
  };

  const openCv = async (u: AppUser) => {
    // Para el administrador se muestra el CV del portafolio (el del constructor y el que envía el bot)
    const main = u.role === 'owner';
    setViewing({ user: u, data: null, main });
    try {
      const data = main ? ((await fetchPortfolio()) ?? seedData) : await fetchProfile(u.uid);
      setViewing({ user: u, data, main });
    } catch (e) {
      alert(`No se pudo cargar el CV: ${(e as Error).message}`);
      setViewing(null);
    }
  };

  const shown = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (u.username ?? '').includes(q));
  }, [users, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users ?? []) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  if (error) return <p className="text-red-500 text-sm">Error al cargar usuarios: {error}</p>;
  if (!users) return <p className="text-sm opacity-70">Cargando usuarios…</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <RoleRequests onReviewed={load} />
      <PlanSettingsCard />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-bold flex-1">
          Usuarios registrados <span className="text-sm opacity-60">({users.length})</span>
        </h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nombre, @usuario o correo…"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm w-64"
        />
        <button onClick={load} className="text-sm px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800">
          <i className="fas fa-rotate mr-1" /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {(['owner', ...ASSIGNABLE_ROLES] as Role[]).map((r) => (
          <div key={r} className="rounded-xl p-3 bg-white/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800">
            <div className="text-2xl font-bold">{counts[r] ?? 0}</div>
            <div className="text-xs font-semibold">{ROLE_LABELS[r]}</div>
            <div className="text-[10px] opacity-60">{ROLE_HELP[r]}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 dark:bg-neutral-900 text-left text-xs uppercase tracking-wide">
            <tr>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2 hidden md:table-cell">Registro</th>
              <th className="px-3 py-2 hidden md:table-cell">Último acceso</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2 text-right">CV</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.uid} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {u.photoURL ? (
                      <img src={u.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
                    ) : (
                      <span className="w-8 h-8 rounded-full bg-primary text-white grid place-items-center font-bold">
                        {(u.name || u.email || '?')[0].toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {u.name || '(sin nombre)'} {u.username && <span className="text-xs font-normal text-primary">@{u.username}</span>}{' '}
                        {u.uid === currentUid && <span className="text-xs opacity-60">(tú)</span>}
                      </div>
                      <div className="text-xs opacity-70 truncate">
                        <i className={`${u.provider === 'google.com' ? 'fab fa-google' : 'fas fa-envelope'} mr-1`} title={u.provider === 'google.com' ? 'Google' : 'Correo y contraseña'} />
                        {u.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{fmt(u.createdAt)}</td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{fmt(u.lastLogin)}</td>
                <td className="px-3 py-2">
                  {u.role === 'owner' ? (
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLE.owner}`} title={ROLE_HELP.owner}>
                      <i className="fas fa-crown mr-1" /> {ROLE_LABELS.owner}
                    </span>
                  ) : (
                  <select
                    value={u.role}
                    disabled={saving === u.uid}
                    title={ROLE_HELP[u.role]}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className={`rounded-full px-2 py-1 text-xs font-semibold border-0 ${ROLE_STYLE[u.role]} disabled:opacity-70`}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r} className="text-black">
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  )}
                  {saving === u.uid && <i className="fas fa-spinner fa-spin ml-2 text-xs" />}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {u.role !== 'owner' && u.role !== 'blocked' && (
                    <button
                      onClick={() => setEditingPerms(u)}
                      className="mr-2 text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/25"
                    >
                      <i className="fas fa-key mr-1" /> Permisos
                    </button>
                  )}
                  <button onClick={() => openCv(u)} className="text-xs px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-primary hover:text-white">
                    <i className="fas fa-eye mr-1" /> Ver CV
                  </button>
                  {u.role !== 'owner' && (
                    <>
                      {u.provider !== 'google.com' && (
                        <button
                          onClick={() => resetPassword(u)}
                          title="Enviar correo para restablecer la contraseña"
                          className="ml-2 text-xs w-8 h-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-amber-500 hover:text-white"
                        >
                          <i className="fas fa-unlock-keyhole" />
                        </button>
                      )}
                      <button
                        onClick={() => removeUser(u)}
                        disabled={saving === u.uid}
                        title="Eliminar usuario"
                        className="ml-2 text-xs w-8 h-8 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="text-center text-sm opacity-60 py-8">Sin resultados</p>}
      </div>

      {viewing && <CvModal user={viewing.user} data={viewing.data} main={viewing.main} onClose={() => setViewing(null)} />}
      {editingPerms && (
        <PermissionsModal
          user={editingPerms}
          onClose={() => setEditingPerms(null)}
          onSaved={(permissions) => {
            setUsers((all) => all!.map((x) => (x.uid === editingPerms.uid ? { ...x, permissions } : x)));
            setEditingPerms(null);
          }}
        />
      )}
    </div>
  );
}

function CvModal({ user, data, main, onClose }: { user: AppUser; data: PortfolioData | null; main?: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [pdfMeta, setPdfMeta] = useState<CvPdfMeta | null>(null);
  useEffect(() => {
    if (main) fetchCvPdfMeta().then(setPdfMeta);
  }, [main]);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-light-bg dark:bg-dark-bg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="flex-1 font-bold">
            {main ? 'Tu CV del portafolio (constructor)' : `CV de ${user.name || user.email}`}
          </h3>
          {main && pdfMeta && (
            <button
              onClick={() => downloadPublishedCv()}
              title={`Publicado el ${new Date(pdfMeta.publishedAt).toLocaleString('es')}`}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
            >
              <i className="fas fa-robot mr-1" /> PDF que envía el bot
            </button>
          )}
          {data && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await downloadCvPdf(data).catch((e) => alert(e.message));
                setBusy(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
            >
              <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-1`} /> Descargar PDF
            </button>
          )}
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800" aria-label="Cerrar">
            <i className="fas fa-xmark" />
          </button>
        </div>
        {data === null ? (
          <p className="text-center text-sm opacity-70 py-16">
            {user.name || user.email} todavía no ha creado su CV (o se está cargando…).
          </p>
        ) : (
          <ScaledCv data={data} />
        )}
      </div>
    </div>
  );
}

/** Matriz de permisos: qué puede hacer el usuario en cada sección de SU PROPIO CV. */
function PermissionsModal({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: (p: Permissions) => void }) {
  const [perms, setPerms] = useState<Permissions>({ ...(user.permissions ?? {}) });
  const [saving, setSaving] = useState(false);
  const groups = [...new Set(PERM_SECTIONS.map((s) => s.group))];
  // "Aplicar a todo" respeta las filas de sí/no (las deja como estén)
  const setAll = (level: PermLevel) =>
    setPerms({ ...perms, ...Object.fromEntries(PERM_SECTIONS.filter((s) => !binaryOn(s.key)).map((s) => [s.key, level])) } as Permissions);

  const save = async () => {
    setSaving(true);
    try {
      await setUserPermissions(user.uid, perms);
      onSaved(perms);
    } catch (e) {
      alert(`No se pudieron guardar los permisos: ${(e as Error).message}`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-light-bg dark:bg-dark-bg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="flex-1 font-bold text-lg">
            <i className="fas fa-key text-primary mr-2" />
            Permisos de {user.name || user.email}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800" aria-label="Cerrar">
            <i className="fas fa-xmark" />
          </button>
        </div>
        <p className="text-xs opacity-70 mb-4">
          Qué puede hacer en <strong>su propio CV</strong> (/mi-cv). <strong>Ver</strong>: solo lectura · <strong>Editar</strong>: modifica lo
          existente (por defecto) · <strong>Crear y eliminar</strong>: control total. Se aplican también en el servidor.
        </p>
        <div className="flex flex-wrap gap-2 mb-4 text-xs">
          <span className="opacity-70 self-center">Aplicar a todo:</span>
          {PERM_LEVELS.map((l) => (
            <button key={l} onClick={() => setAll(l)} className="px-2.5 py-1 rounded-full bg-neutral-200 dark:bg-neutral-800 hover:bg-primary hover:text-white">
              {PERM_LABELS[l]}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Sección</th>
                {PERM_LEVELS.map((l) => (
                  <th key={l} className="px-2 py-2 text-center font-semibold">
                    {PERM_LABELS[l]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50">
                    <td colSpan={5} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider opacity-60">
                      {g}
                    </td>
                  </tr>
                  {PERM_SECTIONS.filter((s) => s.group === g).map((s) => (
                    <tr key={s.key} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2">{s.label}</td>
                      {PERM_LEVELS.map((l) => {
                        const on = binaryOn(s.key);
                        // Filas de sí/no: solo "Sin acceso" y "permitido"
                        if (on && l !== 'none' && l !== on) return <td key={l} className="text-center opacity-30">—</td>;
                        return (
                          <td key={l} className="text-center">
                            <label className="inline-flex items-center gap-1">
                              <input
                                type="radio"
                                name={`perm-${s.key}`}
                                aria-label={`${s.label}: ${on && l === on ? 'Permitido' : PERM_LABELS[l]}`}
                                checked={(perms[s.key] ?? defaultLevel(s.key)) === l}
                                onChange={() => setPerms({ ...perms, [s.key]: l })}
                              />
                              {on && l === on && <span className="text-[10px] font-semibold text-emerald-600">Sí</span>}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}
