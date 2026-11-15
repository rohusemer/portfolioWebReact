import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { resizeImageFile } from '../../../lib/image';

// ---------- Permisos de edición del bloque actual ----------
// readOnly: solo ver. canCreate: puede agregar/eliminar elementos de listas.
export interface FieldPerms {
  readOnly: boolean;
  canCreate: boolean;
}
const PermsCtx = createContext<FieldPerms>({ readOnly: false, canCreate: true });
export const FieldPermsProvider = PermsCtx.Provider;
export const useFieldPerms = () => useContext(PermsCtx);

const inputCls =
  'w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm';

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const { readOnly } = useFieldPerms();
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">{label}</span>
      <input
        type={type}
        className={`${inputCls} read-only:opacity-60 read-only:cursor-not-allowed`}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

type Wrap = { before: string; after?: string; placeholder: string; line?: boolean };
const TOOLS: { icon: string; title: string; wrap: Wrap }[] = [
  { icon: 'fa-bold', title: 'Negrita', wrap: { before: '**', after: '**', placeholder: 'texto' } },
  { icon: 'fa-italic', title: 'Cursiva', wrap: { before: '_', after: '_', placeholder: 'texto' } },
  { icon: 'fa-list-ul', title: 'Lista', wrap: { before: '- ', placeholder: 'elemento', line: true } },
  { icon: 'fa-link', title: 'Enlace', wrap: { before: '[', after: '](https://)', placeholder: 'texto' } },
];

/** Textarea con mini barra de herramientas Markdown. */
export function MarkdownField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { readOnly } = useFieldPerms();

  const apply = ({ before, after = '', placeholder, line }: Wrap) => {
    const ta = ref.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const selected = value.slice(s, e) || placeholder;
    const prefix = line && s > 0 && value[s - 1] !== '\n' ? '\n' : '';
    const insert = prefix + before + selected + after;
    onChange(value.slice(0, s) + insert + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      const start = s + prefix.length + before.length;
      ta.setSelectionRange(start, start + selected.length);
    });
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {label} <i className="fab fa-markdown ml-1" title="Admite Markdown" />
        </span>
        <div className={`flex gap-1 ${readOnly ? 'hidden' : ''}`}>
          {TOOLS.map((t) => (
            <button
              key={t.icon}
              type="button"
              title={t.title}
              onClick={() => apply(t.wrap)}
              className="w-7 h-7 rounded text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              <i className={`fas ${t.icon}`} />
            </button>
          ))}
        </div>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        readOnly={readOnly}
        className={`${inputCls} font-mono read-only:opacity-60 read-only:cursor-not-allowed`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Editor genérico de listas: agregar, eliminar y reordenar elementos. */
export function ListEditor<T extends { id: string }>({
  items,
  onChange,
  create,
  title,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  title: (item: T) => string;
  render: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const { readOnly, canCreate } = useFieldPerms();
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <details key={item.id} className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/60">
          <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 select-none">
            <span className="flex-1 font-semibold text-sm truncate">{title(item) || '(sin título)'}</span>
            {!readOnly && (
              <>
                <IconBtn icon="fa-arrow-up" title="Subir" onClick={() => move(i, -1)} />
                <IconBtn icon="fa-arrow-down" title="Bajar" onClick={() => move(i, 1)} />
              </>
            )}
            {canCreate && !readOnly && (
              <IconBtn
                icon="fa-trash"
                title="Eliminar"
                danger
                onClick={() => confirm('¿Eliminar este elemento?') && onChange(items.filter((x) => x.id !== item.id))}
              />
            )}
          </summary>
          <div className="px-3 pb-2 pt-1">
            {render(item, (patch) => onChange(items.map((x) => (x.id === item.id ? { ...x, ...patch } : x))))}
          </div>
        </details>
      ))}
      {canCreate && !readOnly && (
      <button
        type="button"
        onClick={() => onChange([...items, create()])}
        className="w-full rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
      >
        <i className="fas fa-plus mr-2" />
        Agregar
      </button>
      )}
    </div>
  );
}

function IconBtn({ icon, title, onClick, danger }: { icon: string; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`w-7 h-7 rounded text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 ${danger ? 'text-red-500' : ''}`}
    >
      <i className={`fas ${icon}`} />
    </button>
  );
}

/**
 * Foto: URL o subida desde el equipo. La imagen se recorta en cuadrado, se
 * reduce a 400×400 y se comprime (≈30–60 KB), y se guarda en el propio
 * documento como data URL. No necesita Firebase Storage (que es de pago).
 */
export function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { readOnly } = useFieldPerms();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setError('');
    try {
      onChange(await resizeImageFile(file));
    } catch (e) {
      setError((e as Error).message || 'No se pudo leer la imagen.');
    }
  };

  const isData = value.startsWith('data:');
  return (
    <div className="mb-3">
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 grid place-items-center">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <i className="fas fa-user text-2xl opacity-40" />}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <input
            className={`${inputCls} read-only:opacity-60`}
            value={isData ? '(imagen subida desde tu equipo)' : value}
            placeholder="/img/profile.jpg o https://…"
            readOnly={readOnly || isData}
            onChange={(e) => onChange(e.target.value)}
          />
          {!readOnly && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-accent"
              >
                <i className="fas fa-upload mr-1" /> Subir imagen
              </button>
              {value && (
                <button type="button" onClick={() => onChange('')} className="px-3 py-1.5 rounded-lg text-xs hover:bg-neutral-200 dark:hover:bg-neutral-800">
                  Quitar
                </button>
              )}
              <input
                ref={input}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = '';
                }}
              />
            </div>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
