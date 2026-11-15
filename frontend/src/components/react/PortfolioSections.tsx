import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PortfolioData } from '../../lib/types';
import { loadPortfolioOnce, savePortfolio } from '../../lib/firebase';
import { setEditMode, useSession } from '../../lib/session';
import { can, isStaff, type PermLevel, type PermSection } from '../../lib/firebase';
import type { Tab } from './admin/Editor';
import Markdown from './Markdown';

// El editor solo se descarga cuando un administrador entra en modo edición
const Editor = lazy(() => import('./admin/Editor'));

export type SectionKey = 'about' | 'skills' | 'experience' | 'education' | 'projects';

interface Props {
  initialData: PortfolioData;
  sections?: SectionKey[];
  /** false en la vista previa del admin: no consulta Firestore */
  live?: boolean;
}

const ALL: SectionKey[] = ['about', 'skills', 'experience', 'education', 'projects'];

/** Permiso necesario para editar cada sección del portafolio. */
const SECTION_PERM: Record<SectionKey, PermSection> = {
  about: 'profile',
  skills: 'skills',
  experience: 'experience',
  education: 'education',
  projects: 'projects',
};

const SECTION_TAB: Record<SectionKey, Tab[]> = {
  about: ['profile', 'contact'],
  skills: ['skills'],
  experience: ['experience'],
  education: ['education'],
  projects: ['projects'],
};

export default function PortfolioSections({ initialData, sections = ALL, live = true }: Props) {
  const [data, setData] = useState(initialData);
  const [published, setPublished] = useState(initialData);
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const session = useSession();
  const canEdit = live && session.editMode && isStaff(session.role);
  const dirty = canEdit && JSON.stringify(data) !== JSON.stringify(published);
  const levelOf = (sec: PermSection): PermLevel => (session.role === 'owner' ? 'create' : (session.permissions[sec] ?? 'none'));
  const mayEdit = (key: SectionKey) => can(session.role, session.permissions, SECTION_PERM[key], 'edit');

  useEffect(() => setData(initialData), [initialData]);

  useEffect(() => {
    if (!live) return;
    loadPortfolioOnce().then((remote) => {
      if (remote) {
        setData(remote);
        setPublished(remote);
      }
    });
  }, [live]);

  const save = async () => {
    setSaving(true);
    try {
      await savePortfolio(data);
      setPublished(data);
      setEditing(null);
    } catch (e) {
      alert(`No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const withPencil = (key: SectionKey, node: ReactNode) =>
    canEdit && mayEdit(key) ? (
      <div key={key} className={`relative outline-dashed outline-2 outline-offset-[-8px] rounded-xl ${editing === key ? 'outline-primary' : 'outline-primary/30'}`}>
        <button
          onClick={() => setEditing(key)}
          className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold shadow-lg hover:bg-accent"
        >
          <i className="fas fa-pen mr-1" /> Editar
        </button>
        {node}
      </div>
    ) : (
      node
    );

  return (
    <>
      {canEdit && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full shadow-2xl bg-neutral-900 text-white text-sm">
          <i className="fas fa-pen-to-square text-amber-400" />
          <span className="hidden sm:inline">Modo edición</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${dirty ? 'bg-amber-500/30 text-amber-300' : 'bg-emerald-500/30 text-emerald-300'}`}>
            {dirty ? 'Sin guardar' : 'Publicado'}
          </span>
          <button onClick={save} disabled={!dirty || saving} className="px-3 py-1 rounded-full bg-primary hover:bg-accent disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={() => setData(published)}
            disabled={!dirty}
            title="Descartar cambios"
            className="px-2 py-1 rounded-full hover:bg-white/10 disabled:opacity-40"
          >
            <i className="fas fa-rotate-left" />
          </button>
          <button
            onClick={() => {
              if (dirty && !confirm('Tienes cambios sin guardar. ¿Salir igualmente?')) return;
              setData(published);
              setEditing(null);
              setEditMode(false);
            }}
            title="Salir del modo edición"
            className="px-2 py-1 rounded-full hover:bg-white/10"
          >
            <i className="fas fa-xmark" />
          </button>
        </div>
      )}

      {canEdit && editing && (
        <aside className="fixed top-0 right-0 z-[60] h-full w-full max-w-md overflow-y-auto shadow-2xl bg-light-bg dark:bg-dark-bg text-dark-text dark:text-light-text border-l border-neutral-300 dark:border-neutral-700">
          <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-light-bg/95 dark:bg-dark-bg/95 border-b border-neutral-300 dark:border-neutral-700">
            <h2 className="flex-1 font-bold">Editando sección</h2>
            <button onClick={save} disabled={!dirty || saving} className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setEditing(null)} aria-label="Cerrar" className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800">
              <i className="fas fa-xmark" />
            </button>
          </div>
          <div className="p-4">
            <p className="text-xs opacity-70 mb-3">Los cambios se ven al instante en la página. Pulsa Guardar para publicarlos.</p>
            <Suspense fallback={<p>Cargando editor…</p>}>
              <Editor key={editing} data={data} onChange={setData} initialTab={SECTION_TAB[editing][0]} only={SECTION_TAB[editing]} levelOf={levelOf} />
            </Suspense>
          </div>
        </aside>
      )}

      {sections.map((key) => withPencil(key, renderSection(key)))}
    </>
  );

  function renderSection(key: SectionKey) {
        switch (key) {
          case 'about':
            return <About key={key} data={data} />;
          case 'skills':
            return (
              <Timeline key={key} id="skills" title="Habilidades">
                {data.skills.map((s) => (
                  <TimelineCard key={s.id} title={s.category}>
                    <p>{s.items}</p>
                  </TimelineCard>
                ))}
              </Timeline>
            );
          case 'experience':
            return (
              <Timeline key={key} id="experience" title="Experiencia Laboral">
                {data.experience.map((e) => (
                  <TimelineCard key={e.id} title={e.company} subtitle={`${e.start} – ${e.end} · ${e.role}`}>
                    <Markdown source={e.description} />
                  </TimelineCard>
                ))}
              </Timeline>
            );
          case 'education':
            return (
              <Timeline key={key} id="education" title="Educación">
                {data.education.map((e) => (
                  <TimelineCard key={e.id} title={e.title} subtitle={`${e.kind}, ${e.institution}`}>
                    <Markdown source={e.description} />
                  </TimelineCard>
                ))}
              </Timeline>
            );
          case 'projects':
            return (
              <Timeline key={key} id="projects" title="Proyectos">
                {data.projects.map((p) => (
                  <TimelineCard key={p.id} title={p.name} href={p.url}>
                    <Markdown source={p.description} />
                  </TimelineCard>
                ))}
              </Timeline>
            );
        }
  }
}

/** Aparece suavemente al entrar en pantalla. */
function Reveal({ id, children }: { id: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return setVisible(true);
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <section ref={ref} id={id} className={`py-20 ${visible ? 'section-visible' : 'section-hidden'}`}>
      {children}
    </section>
  );
}

function About({ data }: { data: PortfolioData }) {
  // Los botones de CV y contacto son para visitantes; un admin no los necesita
  const role = isStaff(useSession().role);
  return (
    <Reveal id="about">
      <div className="container mx-auto px-4">
        <div className="relative bg-light-bg/50 dark:bg-glass backdrop-blur-glass border dark:border-glass rounded-lg shadow-xl p-8">
          <h2 className="text-center text-4xl font-bold mb-2 text-primary">Sobre Mí</h2>
          <p className="text-center text-sm uppercase tracking-widest mb-8 opacity-80">{data.profile.title}</p>
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <img
              src={data.profile.photoUrl}
              alt={data.profile.name}
              className="w-48 h-48 object-cover rounded-full shadow-lg mx-auto md:mx-0 flex-shrink-0"
            />
            <Markdown source={data.profile.about} className="text-lg text-justify space-y-4" />
          </div>
          {role ? (
            <p className="text-center text-xs mt-8 opacity-60">
              <i className="fas fa-user-shield mr-1" />
              Vista de administrador: los visitantes ven aquí los botones de CV y contacto.
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-cv'))}
                className="bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-accent transition-colors duration-300"
              >
                <i className="fas fa-file-pdf mr-2" />
                Ver / Descargar CV
              </button>
              {data.contact.email && (
                <a
                  href={`mailto:${data.contact.email}`}
                  className="border border-primary text-primary font-bold py-3 px-6 rounded-lg hover:bg-primary hover:text-white transition-colors duration-300"
                >
                  <i className="fas fa-envelope mr-2" />
                  Contáctame
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function Timeline({ id, title, children }: { id: string; title: string; children: ReactNode[] }) {
  return (
    <Reveal id={id}>
      <h2 className="text-center text-4xl font-bold mb-12 text-primary">{title}</h2>
      <div className="relative container mx-auto px-4">
        <div className="hidden md:block absolute h-full border-l-2 border-primary left-1/2 -translate-x-1/2" />
        {children.map((child, i) => (
          <div
            key={i}
            className={`mb-10 flex flex-col md:flex-row md:justify-between items-center w-full ${
              i % 2 ? 'md:flex-row-reverse' : ''
            }`}
          >
            <div className="hidden md:block md:w-5/12" />
            <div className="hidden md:flex z-20 bg-primary shadow-xl w-8 h-8 rounded-full" />
            {child}
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function TimelineCard({
  title,
  subtitle,
  href,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-light-bg/50 dark:bg-glass backdrop-blur-glass border dark:border-glass rounded-lg shadow-xl w-full md:w-5/12 px-6 py-4 relative">
      <div className="card-mascot">
        <i className="fas fa-robot" />
      </div>
      <h3 className="mb-1 font-bold text-xl text-center">{title}</h3>
      {subtitle && <p className="text-xs text-center font-semibold text-primary mb-3">{subtitle}</p>}
      <div className="text-sm text-center leading-snug tracking-wide opacity-90">{children}</div>
      {href && (
        <div className="text-center mt-4">
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Ver Proyecto
          </a>
        </div>
      )}
    </div>
  );
}
