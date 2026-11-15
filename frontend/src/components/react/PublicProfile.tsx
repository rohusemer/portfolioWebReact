import { useEffect, useState } from 'react';
import { fetchPublicProfile } from '../../lib/firebase';
import { downloadCvPdf } from '../../lib/cvPdf';
import type { PortfolioData } from '../../lib/types';
import { ScaledCv } from './CvViewer';
import PortfolioSections from './PortfolioSections';

/** /perfil?u=<uid>: CV público de un usuario premium. */
export default function PublicProfile() {
  const [data, setData] = useState<PortfolioData | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const uid = new URLSearchParams(location.search).get('u') ?? '';
    if (!/^[A-Za-z0-9._]{3,64}$/.test(uid)) return setData(null);
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
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-dark-text dark:text-light-text">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-light-bg/80 dark:bg-dark-bg/80 border-b border-neutral-200 dark:border-neutral-800">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3">
          {data.profile.photoUrl && <img src={data.profile.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />}
          <span className="font-bold flex-1 truncate">{data.profile.name}</span>
          <a href="#cv" className="text-sm font-semibold hover:text-primary">
            CV
          </a>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await downloadCvPdf(data).catch((e) => alert(e.message));
              setBusy(false);
            }}
            className="px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`} />
            Descargar CV
          </button>
        </div>
      </header>

      <PortfolioSections initialData={data} live={false} />

      <section id="cv" className="py-16 bg-neutral-200/60 dark:bg-neutral-900/60 px-2">
        <h2 className="text-center text-3xl font-bold mb-8 text-primary">Mi CV</h2>
        <ScaledCv data={data} />
      </section>

      <footer className="py-6 text-center text-xs opacity-70">
        <a href="/mi-cv" className="hover:text-primary">
          Crea tu propio CV y sitio web gratis · Sure Developments
        </a>
      </footer>
    </div>
  );
}
