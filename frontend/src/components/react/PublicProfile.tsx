import { useEffect, useState } from 'react';
import { fetchPublicProfile } from '../../lib/firebase';
import { downloadCvPdf } from '../../lib/cvPdf';
import type { PortfolioData } from '../../lib/types';
import { ScaledCv } from './CvViewer';

/** /perfil?u=<uid>: CV público de un usuario premium. */
export default function PublicProfile() {
  const [data, setData] = useState<PortfolioData | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const uid = new URLSearchParams(location.search).get('u') ?? '';
    if (!/^[A-Za-z0-9]{10,64}$/.test(uid)) return setData(null);
    fetchPublicProfile(uid)
      .then((d) => {
        setData(d);
        if (d) document.title = `CV - ${d.profile.name}`;
      })
      .catch(() => setData(null)); // las reglas lo deniegan si no es público
  }, []);

  if (data === undefined) return <p className="text-center py-24 opacity-70">Cargando CV…</p>;
  if (data === null)
    return (
      <div className="text-center py-24 px-4">
        <i className="fas fa-lock text-4xl opacity-40 mb-4" />
        <h1 className="text-xl font-bold mb-2">Este CV no está disponible</h1>
        <p className="text-sm opacity-70 mb-6">Puede que el enlace sea incorrecto o que su dueño lo haya hecho privado.</p>
        <a href="/mi-cv" className="text-primary underline">
          Crea tu propio CV
        </a>
      </div>
    );

  return (
    <div className="min-h-screen bg-neutral-300 dark:bg-neutral-800 py-6 px-2">
      <div className="max-w-[210mm] mx-auto mb-4 flex flex-wrap gap-2 justify-between items-center">
        <a href="/mi-cv" className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:underline">
          <i className="fas fa-id-card mr-1" /> Crea tu CV gratis
        </a>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await downloadCvPdf(data).catch((e) => alert(e.message));
            setBusy(false);
          }}
          className="px-4 py-2 rounded-lg bg-primary text-white font-semibold shadow hover:bg-accent disabled:opacity-50"
        >
          <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`} />
          Descargar PDF
        </button>
      </div>
      <ScaledCv data={data} />
    </div>
  );
}
