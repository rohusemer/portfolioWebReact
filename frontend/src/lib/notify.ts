// Avisos por correo al administrador (nuevos mensajes, sugerencias y solicitudes).
// Usa FormSubmit (https://formsubmit.co), gratuito y sin servidor propio. La primera
// vez FormSubmit envía un correo de activación al destinatario que hay que confirmar.
// Si falla, no pasa nada: el mensaje ya quedó guardado en el panel.
import { fetchPlans } from './firebase';

export async function notifyOwner(subject: string, fields: Record<string, string>) {
  try {
    const plans = await fetchPlans();
    if (!plans.notifyByEmail || !plans.contactEmail) return;
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(plans.contactEmail)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        ...fields,
        Panel: `${location.origin}/admin`,
      }),
    });
  } catch (e) {
    console.warn('No se pudo enviar el aviso por correo:', e);
  }
}
