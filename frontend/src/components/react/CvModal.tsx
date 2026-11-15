import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PortfolioData } from '../../lib/types';
import { downloadPublishedCv, loadPortfolioOnce } from '../../lib/firebase';
import { cvFileBase } from '../../lib/cvMarkdown';
import CvDocument from './CvDocument';
import { ScaledCv } from './CvViewer';
import '../../styles/cv.css';

/** Abre el modal del CV desde cualquier parte del sitio. */
export const openCvModal = () => window.dispatchEvent(new CustomEvent('open-cv'));

/**
 * Modal del CV para visitantes: ver el documento, descargar el PDF o imprimir.
 * Se abre con el evento global "open-cv" (botón "Ver CV", bot, etc.).
 */
export default function CvModal({ initialData }: { initialData: PortfolioData }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(initialData);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      loadPortfolioOnce().then((d) => d && setData(d));
    };
    window.addEventListener('open-cv', onOpen);
    return () => window.removeEventListener('open-cv', onOpen);
  }, []);

  // Esc para cerrar y sin scroll de fondo mientras está abierto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;

  /** Descarga el PDF publicado desde el panel; si aún no hay uno, lo genera al momento. */
  const download = async () => {
    setDownloading(true);
    try {
      const ok = await downloadPublishedCv().catch(() => false);
      if (!ok) {
        const { downloadCvPdf } = await import('../../lib/cvPdf');
        await downloadCvPdf(data);
      }
    } catch (e) {
      alert(`No se pudo descargar el CV: ${(e as Error).message}`);
    } finally {
      setDownloading(false);
    }
  };

  /** Imprime solo el CV (A4, sin márgenes) usando la copia oculta del portal. */
  const print = () => {
    const prevTitle = document.title;
    document.title = cvFileBase(data);
    document.body.classList.add('print-cv');
    window.print();
    document.body.classList.remove('print-cv');
    document.title = prevTitle;
  };

  return createPortal(
    <>
      <div
        className="no-print fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex flex-col"
        onClick={() => setOpen(false)}
        role="dialog"
        aria-modal="true"
        aria-label={`CV de ${data.profile.name}`}
      >
        <div
          className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 bg-white/95 dark:bg-neutral-900/95 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate text-dark-text dark:text-light-text">CV · {data.profile.name}</div>
            <div className="text-xs opacity-60 truncate text-dark-text dark:text-light-text">{data.profile.title}</div>
          </div>
          <button
            onClick={download}
            disabled={downloading}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-accent disabled:opacity-50"
          >
            <i className={`fas ${downloading ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`} />
            Descargar PDF
          </button>
          <button
            onClick={print}
            className="px-4 py-2 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-white"
          >
            <i className="fas fa-print mr-2" />
            Imprimir
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            className="w-10 h-10 rounded-full text-dark-text dark:text-light-text hover:bg-neutral-200 dark:hover:bg-neutral-800"
          >
            <i className="fas fa-xmark text-lg" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="max-w-[210mm] mx-auto" onClick={(e) => e.stopPropagation()}>
            <ScaledCv data={data} />
          </div>
        </div>
      </div>
      {/* Copia sin escalar que solo se ve al imprimir */}
      <div id="cv-print-portal">
        <CvDocument data={data} />
      </div>
    </>,
    document.body,
  );
}
