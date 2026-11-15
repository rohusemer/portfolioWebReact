import { useEffect, useMemo, useState } from 'react';
import { fetchProfile, listUsers, ROLE_LABELS, ROLES, setUserRole, type AppUser, type Role } from '../../../lib/firebase';
import type { PortfolioData } from '../../../lib/types';
import { downloadCvPdf } from '../../../lib/cvPdf';
import { ScaledCv } from '../CvViewer';

const ROLE_STYLE: Record<Role, string> = {
  owner: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  editor: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  user: 'bg-neutral-500/20',
  blocked: 'bg-red-500/20 text-red-600',
};

const ROLE_HELP: Record<Role, string> = {
  owner: 'Todo, incluida la gestión de usuarios',
  editor: 'Edita el portafolio, publica el PDF y lee mensajes',
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
  const [viewing, setViewing] = useState<{ user: AppUser; data: PortfolioData | null } | null>(null);

  const load = () =>
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (u: AppUser, role: Role) => {
    if (role === u.role) return;
    if (role === 'owner' && !confirm(`¿Dar control total (incluida la gestión de usuarios) a ${u.email}?`)) return;
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

  const openCv = async (u: AppUser) => {
    setViewing({ user: u, data: null });
    try {
      const data = await fetchProfile(u.uid);
      setViewing({ user: u, data });
    } catch (e) {
      alert(`No se pudo cargar el CV: ${(e as Error).message}`);
      setViewing(null);
    }
  };

  const shown = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (users ?? []).filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
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
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-xl font-bold flex-1">
          Usuarios registrados <span className="text-sm opacity-60">({users.length})</span>
        </h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm w-64"
        />
        <button onClick={load} className="text-sm px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800">
          <i className="fas fa-rotate mr-1" /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {ROLES.map((r) => (
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
                        {u.name || '(sin nombre)'} {u.uid === currentUid && <span className="text-xs opacity-60">(tú)</span>}
                      </div>
                      <div className="text-xs opacity-70 truncate">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{fmt(u.createdAt)}</td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{fmt(u.lastLogin)}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={u.uid === currentUid || saving === u.uid}
                    title={u.uid === currentUid ? 'No puedes cambiar tu propio rol' : ROLE_HELP[u.role]}
                    onChange={(e) => changeRole(u, e.target.value as Role)}
                    className={`rounded-full px-2 py-1 text-xs font-semibold border-0 ${ROLE_STYLE[u.role]} disabled:opacity-70`}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="text-black">
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  {saving === u.uid && <i className="fas fa-spinner fa-spin ml-2 text-xs" />}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openCv(u)} className="text-xs px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-primary hover:text-white">
                    <i className="fas fa-eye mr-1" /> Ver CV
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="text-center text-sm opacity-60 py-8">Sin resultados</p>}
      </div>

      {viewing && <CvModal user={viewing.user} data={viewing.data} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CvModal({ user, data, onClose }: { user: AppUser; data: PortfolioData | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-4xl rounded-2xl bg-light-bg dark:bg-dark-bg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="flex-1 font-bold">CV de {user.name || user.email}</h3>
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
