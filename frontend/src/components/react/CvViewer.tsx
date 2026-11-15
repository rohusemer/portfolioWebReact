import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PortfolioData } from '../../lib/types';
import { downloadPublishedCv, fetchPortfolio } from '../../lib/firebase';
import { cvFileBase, downloadFile, toMarkdown } from '../../lib/cvMarkdown';
import CvDocument from './CvDocument';

const A4_WIDTH_PX = 794; // 210mm a 96dpi

/** Escala el CV para que entre en pantallas pequeñas (la impresión ignora la escala). */
export function ScaledCv({ data }: { data: PortfolioData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / A4_WIDTH_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="cv-scaler" style={{ height: `${297 * 3.7795 * scale}px` }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        <CvDocument data={data} />
      </div>
    </div>
  );
}

/** Página pública /cv */
export default function CvViewer({ initialData }: { initialData: PortfolioData }) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    fetchPortfolio()
      .then((remote) => remote && setData(remote))
      .catch((err) => console.warn('Usando datos locales del CV:', err));
  }, []);

  const [downloading, setDownloading] = useState(false);
  /** Descarga el PDF publicado por el admin; si no existe, usa el diálogo de impresión. */
  const downloadPdf = async () => {
    setDownloading(true);
    const ok = await downloadPublishedCv().catch(() => false);
    setDownloading(false);
    if (!ok) printPdf();
  };

  const printPdf = () => {
    const prev = document.title;
    document.title = cvFileBase(data); // nombre sugerido del PDF
    window.print();
    document.title = prev;
  };

  return (
    <div className="min-h-screen bg-neutral-300 dark:bg-neutral-800 py-6 px-2">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap gap-2 justify-between items-center">
        <a href="/" className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 hover:underline">
          <i className="fas fa-arrow-left mr-1" /> Volver al portafolio
        </a>
        <div className="flex gap-2">
          <button
            onClick={() => downloadFile(`${cvFileBase(data)}.md`, toMarkdown(data), 'text/markdown')}
            className="px-4 py-2 rounded-lg bg-white/80 text-neutral-900 font-semibold shadow hover:bg-white"
          >
            <i className="fab fa-markdown mr-2" />
            Markdown
          </button>
          <button
            onClick={printPdf}
            title="Imprimir o guardar como PDF con texto seleccionable"
            className="px-4 py-2 rounded-lg bg-white/80 text-neutral-900 font-semibold shadow hover:bg-white"
          >
            <i className="fas fa-print mr-2" />
            Imprimir
          </button>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="px-4 py-2 rounded-lg bg-primary text-white font-semibold shadow hover:bg-accent disabled:opacity-50"
          >
            <i className={`fas ${downloading ? 'fa-spinner fa-spin' : 'fa-file-pdf'} mr-2`} />
            Descargar PDF
          </button>
        </div>
      </div>
      <ScaledCv data={data} />
      <p className="no-print text-center text-xs mt-4 text-neutral-700 dark:text-neutral-300">
        En el diálogo de impresión elige <strong>“Guardar como PDF”</strong>, tamaño A4 y márgenes “Ninguno”.
      </p>
    </div>
  );
}
