import { useEffect } from 'react';
import { isStaff } from '../../lib/firebase';
import { resumeSessionIfHinted, useSession } from '../../lib/session';

/** Llamada a la acción del navbar para visitantes: abre el bot de contacto. Se oculta para administradores/editores. */
export default function HireButton({ block = false }: { block?: boolean }) {
  const { role } = useSession();
  useEffect(resumeSessionIfHinted, []);
  if (isStaff(role)) return null;
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('open-bot'))}
      className={`${block ? 'w-full justify-center py-3' : 'px-4 py-2'} inline-flex items-center gap-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#1d4ed8] to-[#0ea5e9] shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/40 hover:-translate-y-px transition-all`}
    >
      <i className="fas fa-handshake" />
      Contrátame
    </button>
  );
}
