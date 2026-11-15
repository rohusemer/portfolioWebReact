import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { BASE_BLOCKS, DEFAULT_BLOCK_TITLES, type BaseBlock, type CvColumn, type ExperienceItem, type PortfolioData } from '../../lib/types';
import Markdown from './Markdown';

// ---------- Utilidades de bloques ----------

export const allBlockIds = (d: PortfolioData) => [...BASE_BLOCKS, ...d.cv.custom.map((c) => `custom:${c.id}`)];

export const hiddenBlockIds = (d: PortfolioData) =>
  allBlockIds(d).filter((id) => !d.cv.layout.sidebar.includes(id) && !d.cv.layout.main.includes(id));

export function blockTitle(d: PortfolioData, id: string): string {
  if (d.cv.titles[id]) return d.cv.titles[id];
  if (id.startsWith('custom:')) return d.cv.custom.find((c) => `custom:${c.id}` === id)?.title || 'Bloque personalizado';
  return DEFAULT_BLOCK_TITLES[id as BaseBlock] ?? id;
}

// ---------- Modo constructor (solo admin) ----------

export interface BuilderApi {
  selected: string | null;
  select: (id: string | null) => void;
  dragging: string | null;
  setDragging: (id: string | null) => void;
  dropTarget: { col: CvColumn; index: number } | null;
  setDropTarget: (t: { col: CvColumn; index: number } | null) => void;
  move: (id: string, col: CvColumn, index: number) => void;
  hide: (id: string) => void;
  onOverflow: (overflow: boolean) => void;
}

const BuilderCtx = createContext<BuilderApi | null>(null);
export const BuilderProvider = BuilderCtx.Provider;

const DRAG_MIME = 'application/x-cv-block';

export function readDragId(e: DragEvent) {
  return e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
}
export function startDrag(e: DragEvent, id: string, b: BuilderApi) {
  e.dataTransfer.setData(DRAG_MIME, id);
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
  b.setDragging(id);
}

// ---------- Documento ----------

/** Agrupa experiencias consecutivas de la misma empresa (como en el PDF original). */
function groupByCompany(items: ExperienceItem[]) {
  const groups: { company: string; items: ExperienceItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.company.trim() === item.company.trim()) last.items.push(item);
    else groups.push({ company: item.company, items: [item] });
  }
  return groups;
}

const prettyUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export default function CvDocument({ data, className = '' }: { data: PortfolioData; className?: string }) {
  const b = useContext(BuilderCtx);
  const page = useRef<HTMLElement>(null);
  const style = { '--cv-accent': data.cv.accentColor || '#5b8ec4' } as CSSProperties;

  // Avisa al constructor si el contenido ya no cabe en una página A4
  useLayoutEffect(() => {
    if (!b || !page.current) return;
    const el = page.current;
    b.onOverflow(el.scrollHeight > el.clientHeight + 2);
  });

  return (
    <article ref={page} className={`cv-page ${b ? 'cv-building' : ''} ${className}`} style={style}>
      <div className="cv-band" aria-hidden="true" />
      <aside className="cv-side">
        <Column col="sidebar" data={data} />
      </aside>
      <main className="cv-main">
        <header
          className={`cv-header ${b ? 'cv-block' : ''} ${b?.selected === 'header' ? 'is-selected' : ''}`}
          onClick={b ? () => b.select('header') : undefined}
        >
          <h1>{data.profile.name}</h1>
          <p>{data.profile.title}</p>
        </header>
        <Column col="main" data={data} />
      </main>
    </article>
  );
}

function Column({ col, data }: { col: CvColumn; data: PortfolioData }) {
  const b = useContext(BuilderCtx);
  const ids = data.cv.layout[col].filter((id) => allBlockIds(data).includes(id));
  const line = (i: number) =>
    b?.dragging && b.dropTarget?.col === col && b.dropTarget.index === i ? <div className="cv-drop-line" key={`line-${i}`} /> : null;

  if (!b) return <>{ids.map((id) => <Block key={id} id={id} col={col} data={data} />)}</>;

  return (
    <div
      className="cv-col"
      onDragOver={(e) => {
        e.preventDefault();
        // Si no está sobre ningún bloque, suelta al final de la columna
        if (e.target === e.currentTarget) b.setDropTarget({ col, index: ids.length });
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = readDragId(e);
        const t = b.dropTarget ?? { col, index: ids.length };
        if (id) b.move(id, t.col, t.index);
        b.setDragging(null);
        b.setDropTarget(null);
      }}
    >
      {ids.map((id, i) => (
        <div key={id}>
          {line(i)}
          <div
            draggable
            onDragStart={(e) => startDrag(e, id, b)}
            onDragEnd={() => {
              b.setDragging(null);
              b.setDropTarget(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientY > r.top + r.height / 2;
              b.setDropTarget({ col, index: after ? i + 1 : i });
            }}
            onClick={(e) => {
              e.stopPropagation();
              b.select(id);
            }}
            className={`cv-block ${b.selected === id ? 'is-selected' : ''} ${b.dragging === id ? 'is-dragging' : ''}`}
          >
            <div className="cv-block-tools" data-capture-ignore>
              <span title="Arrastrar">
                <i className="fas fa-grip-vertical" />
              </span>
              <button
                title="Ocultar del CV"
                onClick={(e) => {
                  e.stopPropagation();
                  b.hide(id);
                }}
              >
                <i className="fas fa-eye-slash" />
              </button>
            </div>
            <Block id={id} col={col} data={data} />
          </div>
        </div>
      ))}
      {line(ids.length)}
      {ids.length === 0 && <div className="cv-empty">Arrastra bloques aquí</div>}
    </div>
  );
}

function Heading({ col, children }: { col: CvColumn; children: ReactNode }) {
  return col === 'sidebar' ? <h3>{children}</h3> : <h2>{children}</h2>;
}

function Block({ id, col, data }: { id: string; col: CvColumn; data: PortfolioData }) {
  const { profile, contact } = data;
  const title = <Heading col={col}>{blockTitle(data, id)}</Heading>;

  if (id.startsWith('custom:')) {
    const c = data.cv.custom.find((x) => `custom:${x.id}` === id);
    if (!c) return null;
    return (
      <section className="cv-section">
        {title}
        <Markdown source={c.body} />
      </section>
    );
  }

  switch (id as BaseBlock) {
    case 'photo':
      return profile.photoUrl ? (
        <div className="cv-photo">
          <img src={profile.photoUrl} alt={profile.name} />
        </div>
      ) : null;

    case 'summary':
      return (
        <section className="cv-section">
          {title}
          <Markdown source={profile.summary} className="cv-justify" />
        </section>
      );

    case 'contact':
      return (
        <section className="cv-section">
          {title}
          <ul className="cv-contact">
            {contact.phone && <li>TELÉFONO: {contact.phone}</li>}
            {contact.location && <li>UBICACIÓN: {contact.location}</li>}
            {contact.linkedin && (
              <li>
                LINKEDIN:
                <br />
                <a href={contact.linkedin}>{contact.linkedin}</a>
              </li>
            )}
            {contact.github && (
              <li>
                REPOSITORIO:
                <br />
                <a href={contact.github}>{contact.github}</a>
              </li>
            )}
            {contact.email && (
              <li>
                CORREO ELECTRÓNICO:
                <br />
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
            )}
          </ul>
        </section>
      );

    case 'languages':
      return (
        <section className="cv-section">
          {title}
          <ul className="cv-list">
            {data.languages.map((l) => (
              <li key={l.id}>
                {l.name} - {l.level}
              </li>
            ))}
          </ul>
        </section>
      );

    case 'skills':
      return (
        <section className="cv-section">
          {title}
          {data.skills.map((s) => (
            <p key={s.id} className="cv-skill">
              <strong>{s.category}:</strong> {s.items}
            </p>
          ))}
        </section>
      );

    case 'hobbies':
      return (
        <section className="cv-section">
          {title}
          <ul className="cv-list">
            {data.hobbies
              .filter((h) => h.trim())
              .map((h, i) => (
                <li key={i}>{h}</li>
              ))}
          </ul>
        </section>
      );

    case 'experience':
      return (
        <section className="cv-section">
          {title}
          {groupByCompany(data.experience).map((g, i) => (
            <div key={i} className="cv-entry">
              <h4>{g.company}</h4>
              {g.items.map((e) => (
                <div key={e.id}>
                  <div>
                    {e.start} – {e.end}, {e.role}
                  </div>
                  <Markdown source={e.description} />
                </div>
              ))}
            </div>
          ))}
        </section>
      );

    case 'education':
      return (
        <section className="cv-section">
          {title}
          {data.education.map((e) => (
            <div key={e.id} className="cv-entry">
              <h4>{e.title}</h4>
              <div>
                {e.kind}
                {e.institution && `, ${e.institution}`}
              </div>
              <Markdown source={e.description} />
            </div>
          ))}
        </section>
      );

    case 'projects':
      return (
        <section className="cv-section">
          {title}
          {data.projects.map((p) => (
            <div key={p.id} className="cv-entry">
              <h4>
                {p.name}
                {p.url && (
                  <>
                    {' · '}
                    <a href={p.url}>{prettyUrl(p.url)}</a>
                  </>
                )}
              </h4>
              <Markdown source={p.description} />
            </div>
          ))}
        </section>
      );
  }
  return null;
}
