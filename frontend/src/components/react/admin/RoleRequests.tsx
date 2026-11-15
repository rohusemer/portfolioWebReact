import { useEffect, useState } from 'react';
import { listRoleRequests, reviewRoleRequest, ROLE_LABELS, type RoleRequest } from '../../../lib/firebase';

/** Bandeja de solicitudes de permiso especial (solo el administrador). */
export default function RoleRequests({ onReviewed }: { onReviewed: () => void }) {
  const [reqs, setReqs] = useState<RoleRequest[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setReqs(await listRoleRequests());
    } catch (e) {
      // Antes se ocultaba el error y la lista aparecía vacía
      setError((e as Error).message);
      setReqs([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const review = async (r: RoleRequest, approve: boolean) => {
    if (approve && !confirm(`¿Dar el rol ${ROLE_LABELS[r.requestedRole]} a ${r.email}?`)) return;
    setBusy(r.uid);
    try {
      await reviewRoleRequest(r, approve);
      await load();
      onReviewed();
    } catch (e) {
      alert(`No se pudo procesar: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!reqs) return null;
  const pending = reqs.filter((r) => r.status === 'pending');
  const shown = showAll ? reqs : pending;

  return (
    <section className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white/60 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold flex-1">
          <i className="fas fa-hand-paper text-primary mr-2" />
          Solicitudes de permiso{' '}
          {pending.length > 0 && <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-red-500 text-white">{pending.length} pendientes</span>}
        </h3>
        <label className="text-xs flex items-center gap-1">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Ver historial
        </label>
        <button onClick={load} disabled={loading} className="text-xs px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-800">
          <i className={`fas fa-rotate ${loading ? 'fa-spin' : ''} mr-1`} /> Actualizar
        </button>
      </div>
      {error && (
        <p className="text-xs mb-2 p-2 rounded bg-red-500/10 text-red-600">
          No se pudieron cargar las solicitudes: {error}
        </p>
      )}
      {shown.length === 0 && <p className="text-sm opacity-60">No hay solicitudes {showAll ? '' : 'pendientes'}.</p>}
      <ul className="space-y-2">
        {shown.map((r) => (
          <li key={r.uid} className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.name || r.email}</strong>
              <span className="text-xs opacity-70">{r.email}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-400">
                pide: {ROLE_LABELS[r.requestedRole]}
              </span>
              <span className="flex-1" />
              <time className="text-xs opacity-60">{new Date(r.createdAt).toLocaleString('es')}</time>
            </div>
            {r.message && <p className="mt-1 whitespace-pre-wrap opacity-90">{r.message}</p>}
            {r.paymentRef && (
              <p className="mt-1 text-xs">
                <i className="fas fa-receipt mr-1 text-emerald-600" />
                Referencia de pago: <code className="select-all">{r.paymentRef}</code>{' '}
                <span className="opacity-60">(verifícala en tu cuenta de pagos antes de aprobar)</span>
              </p>
            )}
            {r.status === 'pending' ? (
              <div className="flex gap-2 mt-2">
                <button
                  disabled={busy === r.uid}
                  onClick={() => review(r, true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <i className="fas fa-check mr-1" /> Aprobar
                </button>
                <button
                  disabled={busy === r.uid}
                  onClick={() => review(r, false)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-xs font-semibold disabled:opacity-50"
                >
                  Rechazar
                </button>
                <a href={`mailto:${r.email}`} className="px-3 py-1.5 rounded-lg text-xs text-primary hover:underline">
                  <i className="fas fa-envelope mr-1" /> Escribirle
                </a>
              </div>
            ) : (
              <p className={`mt-2 text-xs font-semibold ${r.status === 'approved' ? 'text-emerald-600' : 'text-red-500'}`}>
                {r.status === 'approved' ? 'Aprobada' : 'Rechazada'} {r.reviewedAt && `· ${new Date(r.reviewedAt).toLocaleDateString('es')}`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
