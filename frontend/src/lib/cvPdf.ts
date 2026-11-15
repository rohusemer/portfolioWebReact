import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { PortfolioData } from './types';
import CvDocument from '../components/react/CvDocument';
import { cvFileBase } from './cvMarkdown';

/**
 * Genera el PDF del CV (A4, 1 página) a partir de los datos actuales.
 * Renderiza el CV fuera de pantalla, lo captura en alta resolución (con el
 * motor del propio navegador, vía html-to-image) y añade
 * los enlaces (correo, LinkedIn, GitHub…) como zonas clicables del PDF.
 */
export async function renderCvPdf(data: PortfolioData): Promise<{ base64: string; blob: Blob; fileName: string }> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:-9999;pointer-events:none;';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(createElement(CvDocument, { data, className: 'cv-capture' }));

  try {
    // Espera a que React pinte, a las fuentes y a las imágenes
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await document.fonts.ready;
    await Promise.all(
      Array.from(host.querySelectorAll('img')).map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => ((img.onload = r), (img.onerror = r))),
      ),
    );

    const page = host.querySelector('.cv-page') as HTMLElement;
    const jpeg = await toJpeg(page, {
      quality: 0.9,
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
      // Solo hace falta incrustar la fuente del CV, no los iconos
      filter: (node) => !(node instanceof HTMLElement && node.dataset.captureIgnore !== undefined),
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    pdf.addImage(jpeg, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

    // Enlaces clicables sobre la imagen
    const pageRect = page.getBoundingClientRect();
    const mm = 210 / pageRect.width;
    page.querySelectorAll('a[href]').forEach((a) => {
      const r = a.getBoundingClientRect();
      pdf.link((r.left - pageRect.left) * mm, (r.top - pageRect.top) * mm, r.width * mm, r.height * mm, {
        url: (a as HTMLAnchorElement).href,
      });
    });

    pdf.setProperties({
      title: `CV - ${data.profile.name}`,
      author: data.profile.name,
      subject: data.profile.title,
      keywords: data.skills.map((s) => s.items).join(', '),
      creator: 'Portafolio de ' + data.profile.name,
    });

    const fileName = `${cvFileBase(data)}.pdf`;
    const dataUri = pdf.output('datauristring');
    return { base64: dataUri.slice(dataUri.indexOf(',') + 1), blob: pdf.output('blob'), fileName };
  } finally {
    root.unmount();
    host.remove();
  }
}


/** Genera el PDF y lo descarga directamente. */
export async function downloadCvPdf(data: PortfolioData) {
  const { blob, fileName } = await renderCvPdf(data);
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
