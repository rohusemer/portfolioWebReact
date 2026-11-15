import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  canPublishProfile,
  deleteMyAccount,
  fetchMyRequest,
  fetchPlans,
  ROLE_LABELS,
  submitRoleRequest,
  type PlanSettings,
  type Role,
  type RoleRequest,
} from '../../lib/firebase';
import type { PortfolioData } from '../../lib/types';
import Markdown from './Markdown';
import { notifyOwner } from '../../lib/notify';

interface Props {
  user: User;
  username: string | null;
  role: Role;
  data: PortfolioData;
  onTogglePublic: (isPublic: boolean) => Promise<void>;
}

/** Pestaña "Mi cuenta" de /mi-cv: rol actual, página pública y solicitud de permisos. */
export default function AccountPanel({ user, username, role, data, onTogglePublic }: Props) {
  const [plans, setPlans] = useState<PlanSettings | null>(null);
  const [request, setRequest] = useState<RoleRequest | null | undefined>(undefined);

  useEffect(() => {
    fetchPlans().then(setPlans);
    fetchMyRequest(user.uid)
      .then(setRequest)
      .catch(() => setRequest(null));
  }, [user.uid]);

  const publicUrl = `${location.origin}/perfil?u=${username ?? user.uid}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <section className="rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 flex items-center gap-4">
        {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-14 h-14 rounded-full" />}
        <div className="flex-1">
          <div className="font-bold">{user.displayName}</div>
          {username && <div className="text-sm text-primary">@{username}</div>}
          <div className="text-sm opacity-70">{user.email}</div>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-semibold bg-primary/10 text-primary">{ROLE_LABELS[role]}</span>
      </section>

      {canPublishProfile(role) ? (
        <PublicProfileCard url={publicUrl} isPublic={Boolean(data.isPublic)} onToggle={onTogglePublic} />
      ) : (
        plans && <RequestCard user={user} plans={plans} request={request} onSent={setRequest} />
      )}

      {role !== 'owner' && <DeleteAccountCard user={user} />}
    </div>
  );
}

/** Derecho de eliminación (LOPDP): el usuario borra su cuenta y todos sus datos. */
function DeleteAccountCard({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isPassword = user.providerData.some((p) => p.providerId === 'password');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteMyAccount(password);
      alert('Tu cuenta y todos tus datos fueron eliminados.');
      location.href = '/';
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code.includes('wrong-password') || code.includes('invalid-credential')
          ? 'Contraseña incorrecta.'
          : code.includes('popup-closed')
            ? 'Cancelaste la confirmación con Google.'
            : (e as Error).message,
      );
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl p-4 border border-red-300 dark:border-red-900 bg-red-500/5">
      <h3 className="font-bold mb-1 text-red-600">
        <i className="fas fa-triangle-exclamation mr-2" />
        Eliminar mi cuenta
      </h3>
      <p className="text-sm opacity-80 mb-3">
        Borra tu cuenta, tu CV, tu sitio, tu nombre de usuario y tus solicitudes. <strong>No se puede deshacer.</strong> Descarga antes tu CV si
        lo necesitas.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-lg border border-red-500 text-red-600 text-sm font-semibold hover:bg-red-500 hover:text-white">
          Quiero eliminar mi cuenta
        </button>
      ) : (
        <div className="space-y-2">
          {isPassword && (
            <input
              type="password"
              placeholder="Tu contraseña"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
            />
          )}
          <input
            placeholder='Escribe "ELIMINAR" para confirmar'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
          />
          {!isPassword && <p className="text-xs opacity-70">Se abrirá Google para confirmar que eres tú.</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={busy || confirmText.trim().toUpperCase() !== 'ELIMINAR' || (isPassword && !password)}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
            >
              {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PublicProfileCard({ url, isPublic, onToggle }: { url: string; isPublic: boolean; onToggle: (v: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-xl p-4 border border-violet-300 dark:border-violet-800 bg-violet-500/5">
      <h3 className="font-bold mb-1">
        <i className="fas fa-globe text-violet-500 mr-2" />
        Página pública de tu CV
      </h3>
      <p className="text-sm opacity-80 mb-3">Comparte un enlace con reclutadores: verán tu CV y podrán descargarlo en PDF.</p>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={busy}
          onChange={async (e) => {
            setBusy(true);
            await onToggle(e.target.checked);
            setBusy(false);
          }}
        />
        {isPublic ? 'Tu CV es público' : 'Hacer público mi CV'} {busy && <i className="fas fa-spinner fa-spin" />}
      </label>
      {isPublic && (
        <div className="flex gap-2">
          <input readOnly value={url} className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs" />
          <button
            onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold"
          >
            {copied ? 'Copiado ✔' : 'Copiar'}
          </button>
          <a href={url} target="_blank" rel="noopener" className="px-3 py-2 rounded-lg border border-violet-500 text-violet-600 text-xs font-semibold">
            Ver
          </a>
        </div>
      )}
    </section>
  );
}

function RequestCard({
  user,
  plans,
  request,
  onSent,
}: {
  user: User;
  plans: PlanSettings;
  request: RoleRequest | null | undefined;
  onSent: (r: RoleRequest) => void;
}) {
  const requestedRole = 'premium' as const;
  const [message, setMessage] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const safePayLink = /^https:\/\//i.test(plans.paymentLink) ? plans.paymentLink : '';
  // Muchos proveedores aceptan una referencia en la URL; así el pago queda asociado a la cuenta
  const payUrl = safePayLink && `${safePayLink}${safePayLink.includes('?') ? '&' : '?'}client_reference_id=${user.uid}`;

  const mailto = `mailto:${plans.contactEmail}?subject=${encodeURIComponent(
    `Solicitud de permiso ${ROLE_LABELS[requestedRole]}`,
  )}&body=${encodeURIComponent(
    `Hola,\n\nQuisiera solicitar el permiso "${ROLE_LABELS[requestedRole]}".\n\nNombre: ${user.displayName}\nCorreo: ${user.email}\nID de usuario: ${user.uid}\n${paymentRef ? `Referencia de pago: ${paymentRef}\n` : ''}\n${message}\n`,
  )}`;

  const send = async () => {
    setState('sending');
    const r = { uid: user.uid, email: user.email ?? '', name: user.displayName ?? '', requestedRole, message, paymentRef };
    try {
      await submitRoleRequest(r);
      // Se vuelve a leer del servidor para confirmar que quedó registrada
      const saved = await fetchMyRequest(user.uid);
      if (!saved) throw new Error('La solicitud no quedó registrada.');
      onSent(saved);
      notifyOwner(`Solicitud de permiso Premium de ${r.name || r.email}`, {
        Usuario: r.name,
        Correo: r.email,
        Mensaje: r.message || '—',
        'Referencia de pago': r.paymentRef || '—',
      });
      setState('idle');
    } catch (e) {
      setErrMsg((e as Error).message);
      setState('error');
    }
  };

  if (request?.status === 'pending') {
    return (
      <section className="rounded-xl p-4 border border-amber-300 dark:border-amber-800 bg-amber-500/5">
        <h3 className="font-bold mb-1">
          <i className="fas fa-hourglass-half text-amber-500 mr-2" />
          Solicitud enviada
        </h3>
        <p className="text-sm opacity-80">
          Pediste el permiso <strong>{ROLE_LABELS[request.requestedRole]}</strong> el {new Date(request.createdAt).toLocaleDateString('es')}. El
          administrador la revisará pronto; cuando se apruebe, recarga la página.
        </p>
        <a href={mailto} className="inline-block mt-3 text-sm text-primary hover:underline">
          <i className="fas fa-envelope mr-1" /> Enviar también por correo
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60">
      <h3 className="font-bold mb-1">
        <i className="fas fa-gem text-violet-500 mr-2" />
        Hazte Premium
      </h3>
      {request?.status === 'rejected' && (
        <p className="text-xs mb-2 text-red-500">Tu solicitud anterior fue rechazada. Puedes enviar una nueva.</p>
      )}

      {plans.premiumEnabled && (
        <div className="rounded-lg p-3 mb-4 bg-violet-500/5 border border-violet-200 dark:border-violet-900">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-bold">Premium</span>
            <span className="text-sm text-violet-600 dark:text-violet-400 font-semibold">{plans.premiumPrice}</span>
          </div>
          <Markdown source={plans.perks} className="text-sm" />
        </div>
      )}



      {!plans.premiumEnabled && <p className="text-sm opacity-70 mb-3">El plan Premium no está disponible por ahora.</p>}
      {payUrl && (
        <div className="mb-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-300 dark:border-emerald-900">
          <p className="text-sm mb-2">
            <strong>Paso 1:</strong> realiza el pago ({plans.premiumPrice}).
          </p>
          <a href={payUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">
            <i className="fas fa-credit-card mr-1" /> Pagar ahora
          </a>
          <p className="text-sm mt-3 mb-1">
            <strong>Paso 2:</strong> pega la referencia o número de transacción:
          </p>
          <input
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            maxLength={200}
            placeholder="Ej: 5TY12345AB678901C"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
          />
        </div>
      )}

      <label className="block mb-3">
        <span className="block text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">Mensaje (opcional)</span>
        <textarea
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Cuéntale al administrador por qué lo necesitas…"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        />
      </label>

      {state === 'error' && (
        <p className="text-xs text-red-500 mb-2">
          No se pudo enviar la solicitud{errMsg ? `: ${errMsg}` : ''}. {!user.emailVerified && 'Primero verifica tu correo.'}
        </p>
      )}
      {!user.emailVerified && <p className="text-xs text-amber-600 mb-2">Necesitas verificar tu correo para enviar la solicitud.</p>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={send}
          disabled={state === 'sending' || !plans.premiumEnabled || !user.emailVerified}
          title={user.emailVerified ? undefined : 'Primero verifica tu correo'}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-accent disabled:opacity-50"
        >
          <i className="fas fa-paper-plane mr-1" /> {state === 'sending' ? 'Enviando…' : 'Enviar solicitud'}
        </button>
        <a href={mailto} className="px-4 py-2 rounded-lg border border-primary text-primary text-sm font-semibold">
          <i className="fas fa-envelope mr-1" /> Avisar también por correo
        </a>
        <p className="w-full text-[11px] opacity-60">
          “Enviar solicitud” la registra en el panel del administrador. El correo es solo un aviso adicional.
        </p>
      </div>
    </section>
  );
}
