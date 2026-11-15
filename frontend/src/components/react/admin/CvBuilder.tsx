import { useState, type ReactNode } from 'react';
import { DEFAULT_BLOCK_TITLES, newId, type BaseBlock, type CvColumn, type CvPdfMeta, type PortfolioData } from '../../../lib/types';
import { BuilderProvider, blockTitle, hiddenBlockIds, readDragId, startDrag, type BuilderApi } from '../CvDocument';
import { ScaledCv } from '../CvViewer';
import Editor, { type Tab } from './Editor';
import type { PermLevel, PermSection } from '../../../lib/firebase';
import { FieldPermsProvider } from './fields';
import { Field, MarkdownField } from './fields';

const BLOCK_ICONS: Record<string, string> = {
  photo: 'fa-image',
  summary: 'fa-id-card',
  contact: 'fa-address-book',
  languages: 'fa-language',
  skills: 'fa-screwdriver-wrench',
  hobbies: 'fa-futbol',
  experience: 'fa-briefcase',
  education: 'fa-graduation-cap',
  projects: 'fa-diagram-project',
  header: 'fa-heading',
};

/** Qué pestaña del editor de contenido corresponde a cada bloque. */
const BLOCK_TAB: Record<string, Tab> = {
  header: 'profile',
  photo: 'profile',
  summary: 'profile',
  contact: 'contact',
  languages: 'extra',
  hobbies: 'extra',
  skills: 'skills',
  experience: 'experience',
  education: 'education',
  projects: 'projects',
};

/** Columna preferida al añadir un bloque desde la paleta. */
const PREFERRED_COL: Record<string, CvColumn> = {
  photo: 'sidebar',
  summary: 'sidebar',
  contact: 'sidebar',
  languages: 'sidebar',
  hobbies: 'sidebar',
  skills: 'sidebar',
};

interface Props {
  data: PortfolioData;
  onChange: (d: PortfolioData) => void;
  /** Tarjeta superior: publicar el PDF del bot (admin) o descargar el CV (usuario) */
  topCard?: ReactNode;
  /** Sin permiso para cambiar el diseño: no se puede arrastrar, ocultar ni crear bloques */
  readOnly?: boolean;
  /** Permisos por sección para el editor del bloque seleccionado */
  levelOf?: (s: PermSection) => PermLevel;
}

export default function CvBuilder({ data, onChange, topCard, readOnly = false, levelOf }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: CvColumn; index: number } | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [overPalette, setOverPalette] = useState(false);

  const setCv = (patch: Partial<PortfolioData['cv']>) => onChange({ ...data, cv: { ...data.cv, ...patch } });

  const move = (id: string, col: CvColumn, index: number) => {
    const { sidebar, main } = data.cv.layout;
    const lists = { sidebar: sidebar.filter((x) => x !== id), main: main.filter((x) => x !== id) };
    // Si se mueve dentro de la misma columna hacia abajo, el índice se desplaza al quitarlo
    const from = data.cv.layout[col].indexOf(id);
    const at = from !== -1 && from < index ? index - 1 : index;
    lists[col].splice(Math.max(0, Math.min(at, lists[col].length)), 0, id);
    setCv({ layout: lists });
  };

  const hide = (id: string) => {
    const { sidebar, main } = data.cv.layout;
    setCv({ layout: { sidebar: sidebar.filter((x) => x !== id), main: main.filter((x) => x !== id) } });
    if (selected === id) setSelected(null);
  };

  const api: BuilderApi = {
    selected,
    select: setSelected,
    dragging,
    setDragging,
    dropTarget,
    setDropTarget,
    move,
    hide,
    onOverflow: (o) => o !== overflow && setOverflow(o),
    canArrange: !readOnly,
  };

  const hidden = hiddenBlockIds(data);

  const addCustom = () => {
    const c = { id: newId(), title: 'Nuevo bloque', body: 'Escribe aquí en **Markdown**.' };
    onChange({
      ...data,
      cv: { ...data.cv, custom: [...data.cv.custom, c], layout: { ...data.cv.layout, main: [...data.cv.layout.main, `custom:${c.id}`] } },
    });
    setSelected(`custom:${c.id}`);
  };

  return (
    <div className="flex-1 grid lg:grid-cols-[400px_1fr] min-h-0">
      {/* ---------- Panel izquierdo ---------- */}
      <section className="p-4 overflow-y-auto lg:h-[calc(100vh-49px)] border-r border-neutral-300 dark:border-neutral-800">
        {topCard}

        {overflow && (
          <p className="text-xs mb-3 p-2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <i className="fas fa-triangle-exclamation mr-1" />
            El contenido ya no cabe en una página A4. Oculta algún bloque, muévelo a la otra columna o resume textos.
          </p>
        )}

        {selected ? (
          <Inspector
            id={selected}
            data={data}
            onChange={onChange}
            onClose={() => setSelected(null)}
            onHide={() => hide(selected)}
            canArrange={!readOnly}
            levelOf={levelOf}
          />
        ) : readOnly ? (
          <p className="text-sm opacity-70 p-3 rounded-lg bg-neutral-500/10">
            <i className="fas fa-eye mr-1" /> No tienes permiso para cambiar el diseño del CV. Haz clic en un bloque para ver o editar su
            contenido según tus permisos.
          </p>
        ) : (
          <>
            <h3 className="font-bold mb-1">Bloques disponibles</h3>
            <p className="text-xs opacity-70 mb-3">
              Arrástralos al CV (o pulsa <i className="fas fa-plus" />). Para quitar uno del CV, arrástralo aquí o usa{' '}
              <i className="fas fa-eye-slash" />. Haz clic en cualquier bloque del CV para editarlo.
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOverPalette(true);
              }}
              onDragLeave={() => setOverPalette(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOverPalette(false);
                const id = readDragId(e);
                if (id) hide(id);
                setDragging(null);
                setDropTarget(null);
              }}
              className={`rounded-xl border-2 border-dashed p-2 mb-4 min-h-24 space-y-2 transition-colors ${
                overPalette ? 'border-primary bg-primary/10' : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              {hidden.length === 0 && <p className="text-xs text-center opacity-60 py-6">Todos los bloques están en el CV</p>}
              {hidden.map((id) => (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => startDrag(e, id, api)}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropTarget(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 shadow-sm cursor-grab text-sm"
                >
                  <i className="fas fa-grip-vertical opacity-40" />
                  <i className={`fas ${BLOCK_ICONS[id] ?? 'fa-pen-to-square'} w-4 text-primary`} />
                  <span className="flex-1">{blockTitle(data, id)}</span>
                  <button
                    title="Añadir al CV"
                    onClick={() => move(id, PREFERRED_COL[id] ?? 'main', data.cv.layout[PREFERRED_COL[id] ?? 'main'].length)}
                    className="w-7 h-7 rounded-full hover:bg-primary hover:text-white"
                  >
                    <i className="fas fa-plus" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addCustom}
              className="w-full mb-6 rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              <i className="fas fa-plus mr-2" />
              Nuevo bloque personalizado (certificaciones, logros, voluntariado…)
            </button>

            <h3 className="font-bold mb-2">Estilo</h3>
            <label className="flex items-center gap-3 mb-4 text-sm">
              <input type="color" value={data.cv.accentColor} onChange={(e) => setCv({ accentColor: e.target.value })} />
              Color de acento
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {['#5b8ec4', '#2563eb', '#059669', '#7c3aed', '#dc2626', '#d97706', '#374151'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCv({ accentColor: c })}
                  className={`w-7 h-7 rounded-full ring-offset-2 ${data.cv.accentColor === c ? 'ring-2 ring-primary' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ---------- Lienzo del CV ---------- */}
      <section
        className="p-4 overflow-y-auto lg:h-[calc(100vh-49px)] bg-neutral-200/60 dark:bg-neutral-900/60"
        onClick={() => setSelected(null)}
      >
        <BuilderProvider value={api}>
          <ScaledCv data={data} />
        </BuilderProvider>
      </section>
    </div>
  );
}

/** Tarjeta del admin: el PDF que entrega el bot. */
export function PublishCard({
  pdfMeta,
  updatedAt,
  publishing,
  onPublish,
  onPreviewPdf,
}: {
  pdfMeta: CvPdfMeta | null;
  updatedAt?: string;
  publishing: boolean;
  onPublish: () => void;
  onPreviewPdf: () => void;
}) {
  const outdated = !pdfMeta || !updatedAt || updatedAt > pdfMeta.publishedAt;
  return (
    <div className="rounded-xl p-3 mb-4 bg-primary/10 border border-primary/30">
      <div className="flex items-center gap-2 mb-2">
        <i className="fas fa-robot text-primary" />
        <span className="text-sm font-semibold flex-1">PDF que entrega el bot</span>
        {pdfMeta && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              outdated ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {outdated ? 'Desactualizado' : 'Al día'}
          </span>
        )}
      </div>
      <p className="text-xs opacity-75 mb-3">
        {pdfMeta
          ? `Publicado el ${new Date(pdfMeta.publishedAt).toLocaleString('es')} · ${Math.round(pdfMeta.size / 1024)} KB`
          : 'Todavía no has publicado ningún PDF. Los visitantes verán el enlace a /cv hasta que lo hagas.'}
      </p>
      <div className="flex gap-2">
        <button onClick={onPreviewPdf} className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-white/80 dark:bg-neutral-800">
          <i className="fas fa-eye mr-1" /> Vista previa PDF
        </button>
        <button
          onClick={onPublish}
          disabled={publishing}
          className="flex-[2] px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-accent disabled:opacity-50"
        >
          <i className={`fas ${publishing ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-1`} />
          {publishing ? 'Publicando…' : 'Guardar y publicar PDF'}
        </button>
      </div>
    </div>
  );
}

function Inspector({
  id,
  data,
  onChange,
  onClose,
  onHide,
  canArrange,
  levelOf,
}: {
  id: string;
  data: PortfolioData;
  onChange: (d: PortfolioData) => void;
  onClose: () => void;
  onHide: () => void;
  canArrange: boolean;
  levelOf?: (s: PermSection) => PermLevel;
}) {
  const isCustom = id.startsWith('custom:');
  const custom = isCustom ? data.cv.custom.find((c) => `custom:${c.id}` === id) : undefined;
  const canRename = id !== 'header' && id !== 'photo' && !isCustom;

  const updateCustom = (patch: Partial<{ title: string; body: string }>) =>
    onChange({ ...data, cv: { ...data.cv, custom: data.cv.custom.map((c) => (`custom:${c.id}` === id ? { ...c, ...patch } : c)) } });

  const deleteCustom = () => {
    if (!confirm('¿Eliminar este bloque personalizado?')) return;
    const { sidebar, main } = data.cv.layout;
    onChange({
      ...data,
      cv: {
        ...data.cv,
        custom: data.cv.custom.filter((c) => `custom:${c.id}` !== id),
        layout: { sidebar: sidebar.filter((x) => x !== id), main: main.filter((x) => x !== id) },
      },
    });
    onClose();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800" title="Volver">
          <i className="fas fa-arrow-left" />
        </button>
        <i className={`fas ${BLOCK_ICONS[id] ?? 'fa-pen-to-square'} text-primary`} />
        <h3 className="flex-1 font-bold">{id === 'header' ? 'Nombre y título' : blockTitle(data, id)}</h3>
        {id !== 'header' && canArrange && (
          <button onClick={onHide} title="Ocultar del CV" className="text-xs px-2 py-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800">
            <i className="fas fa-eye-slash mr-1" /> Ocultar
          </button>
        )}
      </div>

      <FieldPermsProvider value={{ readOnly: !canArrange, canCreate: canArrange }}>
      {canRename && (
        <Field
          label="Título del bloque en el CV"
          value={data.cv.titles[id] ?? ''}
          placeholder={DEFAULT_BLOCK_TITLES[id as BaseBlock]}
          onChange={(v) => onChange({ ...data, cv: { ...data.cv, titles: { ...data.cv.titles, [id]: v } } })}
        />
      )}

      {custom && (
        <>
          <Field label="Título" value={custom.title} onChange={(title) => updateCustom({ title })} />
          <MarkdownField label="Contenido" rows={8} value={custom.body} onChange={(body) => updateCustom({ body })} />
          {canArrange && (
            <button onClick={deleteCustom} className="text-sm text-red-500 hover:underline">
              <i className="fas fa-trash mr-1" /> Eliminar bloque
            </button>
          )}
        </>
      )}
      </FieldPermsProvider>
      {!custom && <Editor key={id} data={data} onChange={onChange} initialTab={BLOCK_TAB[id]} only={[BLOCK_TAB[id]]} levelOf={levelOf} />}
    </div>
  );
}
