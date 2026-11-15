import { useEffect, useState } from 'react';
import { DEFAULT_PLANS, fetchPlans, savePlans, type PlanSettings } from '../../../lib/firebase';
import { Field, MarkdownField } from './fields';

/** Configuración del plan Premium (precio, enlace de pago, beneficios). Solo el administrador. */
export default function PlanSettingsCard() {
  const [plans, setPlans] = useState<PlanSettings>(DEFAULT_PLANS);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    fetchPlans().then(setPlans);
  }, []);

  const save = async () => {
    setState('saving');
    try {
      await savePlans(plans);
      setState('saved');
    } catch {
      setState('error');
    }
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="mb-6 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white/60 dark:bg-neutral-900/60"
    >
      <summary className="font-bold cursor-pointer select-none">
        <i className="fas fa-gem text-violet-500 mr-2" />
        Plan Premium y monetización
        <span className="ml-2 text-xs font-normal opacity-70">
          {plans.premiumEnabled ? `${plans.premiumPrice}${plans.paymentLink ? ' · con enlace de pago' : ' · sin pago'}` : 'desactivado'}
        </span>
      </summary>
      <div className="mt-4 grid md:grid-cols-2 gap-x-4">
        <label className="flex items-center gap-2 mb-3 text-sm md:col-span-2">
          <input type="checkbox" checked={plans.premiumEnabled} onChange={(e) => setPlans({ ...plans, premiumEnabled: e.target.checked })} />
          Permitir que los usuarios soliciten el plan Premium
        </label>
        <Field label="Precio (texto que ve el usuario)" placeholder="USD 5 / pago único" value={plans.premiumPrice} onChange={(premiumPrice) => setPlans({ ...plans, premiumPrice })} />
        <Field
          label="Enlace de pago (opcional)"
          placeholder="https://paypal.me/tuusuario/5 o enlace de PayPhone"
          value={plans.paymentLink}
          onChange={(paymentLink) => setPlans({ ...plans, paymentLink })}
        />
        <Field label="Correo para solicitudes" type="email" value={plans.contactEmail} onChange={(contactEmail) => setPlans({ ...plans, contactEmail })} />
        <div className="md:col-span-2">
          <MarkdownField label="Beneficios del plan" rows={4} value={plans.perks} onChange={(perks) => setPlans({ ...plans, perks })} />
        </div>
        <p className="text-xs opacity-70 md:col-span-2 mb-3">
          <i className="fas fa-circle-info mr-1" />
          El usuario paga con tu enlace y pega la referencia del pago en su solicitud. Tú la verificas en tu cuenta (PayPal/PayPhone) y
          apruebas. Para activar el Premium automáticamente al pagar se necesita un webhook en Cloud Functions (plan Blaze de Firebase).
        </p>
        <div className="md:col-span-2 flex items-center gap-3">
          <button
            onClick={save}
            disabled={state === 'saving'}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            {state === 'saving' ? 'Guardando…' : 'Guardar configuración'}
          </button>
          {state === 'saved' && <span className="text-xs text-emerald-600">Guardado ✔</span>}
          {state === 'error' && <span className="text-xs text-red-500">No se pudo guardar</span>}
        </div>
      </div>
    </details>
  );
}
