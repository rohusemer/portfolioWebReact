import { useEffect } from 'react';
import { isStaff } from '../../lib/firebase';
import { resumeSessionIfHinted, useSession } from '../../lib/session';

/**
 * Pestaña del navbar que solo aparece con sesión iniciada:
 *  - administrador / editor → "Panel" (/admin)
 *  - usuario / premium      → "Mi CV" (/mi-cv)
 */
export default function NavPanelLink({ mobile = false }: { mobile?: boolean }) {
  const { status, role } = useSession();

  useEffect(resumeSessionIfHinted, []);

  if (status !== 'in' || !role || role === 'blocked') return null;

  const staff = isStaff(role);
  const href = staff ? '/admin' : '/mi-cv';
  const label = staff ? 'Panel' : 'Mi CV';
  const icon = staff ? 'fa-gauge-high' : 'fa-id-card';

  if (mobile) {
    return (
      <a href={href} className="block p-4 font-semibold text-primary hover:bg-accent/10">
        <i className={`fas ${icon} mr-2`} />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
        staff ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25' : 'bg-primary/10 text-primary hover:bg-primary/20'
      }`}
    >
      <i className={`fas ${icon} mr-1`} />
      {label}
    </a>
  );
}
