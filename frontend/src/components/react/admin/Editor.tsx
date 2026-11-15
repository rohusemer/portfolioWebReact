import { useState, type ReactNode } from 'react';
import { newId, type PortfolioData } from '../../../lib/types';
import type { PermLevel, PermSection } from '../../../lib/firebase';
import { Field, FieldPermsProvider, ImageField, ListEditor, MarkdownField, type FieldPerms } from './fields';

/** Sección de permisos que controla cada pestaña. */
const TAB_SECTION: Record<string, PermSection> = {
  profile: 'profile',
  contact: 'contact',
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  projects: 'projects',
  extra: 'languages',
  cv: 'cv',
  bot: 'bot',
};

const toFieldPerms = (level: PermLevel): FieldPerms => ({
  readOnly: level === 'view' || level === 'none',
  canCreate: level === 'create',
});

const TABS = [
  ['profile', 'Perfil'],
  ['contact', 'Contacto'],
  ['experience', 'Experiencia'],
  ['education', 'Estudios'],
  ['skills', 'Habilidades'],
  ['projects', 'Proyectos'],
  ['extra', 'Idiomas y hobbies'],
  ['cv', 'Opciones CV'],
  ['bot', 'Bot asistente'],
] as const;
export type Tab = (typeof TABS)[number][0];

interface Props {
  data: PortfolioData;
  onChange: (d: PortfolioData) => void;
  initialTab?: Tab;
  /** limita las pestañas visibles (edición en vivo de una sección) */
  only?: Tab[];
  /** Nivel de permiso por sección (editores). Sin esta función se permite todo. */
  levelOf?: (section: PermSection) => PermLevel;
}

export default function Editor({ data, onChange, initialTab = 'profile', only, levelOf = () => 'create' }: Props) {
  const tabLevel = (k: string): PermLevel => {
    if (k === 'extra') {
      const a = levelOf('languages'), b = levelOf('hobbies');
      return a === 'none' ? b : b === 'none' ? a : a; // visible si alguna de las dos lo es
    }
    return levelOf(TAB_SECTION[k]);
  };
  const tabs = TABS.filter(([k]) => (!only || only.includes(k)) && tabLevel(k) !== 'none');
  const [tab, setTab] = useState<Tab>(tabs.some(([k]) => k === initialTab) ? initialTab : (tabs[0]?.[0] ?? initialTab));
  const set = <K extends keyof PortfolioData>(key: K, value: PortfolioData[K]) => onChange({ ...data, [key]: value });

  return (
    <div>
      <nav className={`flex flex-wrap gap-1 mb-4 ${tabs.length < 2 ? 'hidden' : ''}`}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              tab === key ? 'bg-primary text-white' : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
            }`}
          >
            {label}
            {tabLevel(key) === 'view' && <i className="fas fa-eye ml-1 opacity-70" title="Solo lectura" />}
          </button>
        ))}
      </nav>

      {tabs.length === 0 && <p className="text-sm opacity-70">No tienes permisos sobre ninguna sección. Pídeselos al administrador.</p>}
      {tabs.length > 0 && tabLevel(tab) === 'view' && (
        <p className="text-xs mb-3 p-2 rounded bg-neutral-500/10">
          <i className="fas fa-eye mr-1" /> Solo lectura: no tienes permiso para modificar esta sección.
        </p>
      )}
      {tabs.length > 0 && tabLevel(tab) === 'edit' && TAB_SECTION[tab] !== 'profile' && TAB_SECTION[tab] !== 'contact' && (
        <p className="text-xs mb-3 p-2 rounded bg-neutral-500/10">
          <i className="fas fa-pen mr-1" /> Puedes editar lo existente, pero no agregar ni eliminar elementos.
        </p>
      )}
      <FieldPermsProvider value={toFieldPerms(tabs.length ? (tab === 'extra' ? levelOf('languages') : tabLevel(tab)) : 'none')}>

      {tab === 'profile' && (
        <>
          <Field label="Nombre" value={data.profile.name} onChange={(name) => set('profile', { ...data.profile, name })} />
          <Field label="Título profesional" value={data.profile.title} onChange={(title) => set('profile', { ...data.profile, title })} />
          <ImageField label="Foto" value={data.profile.photoUrl} onChange={(photoUrl) => set('profile', { ...data.profile, photoUrl })} />
          <MarkdownField
            label="Perfil corto (CV)"
            rows={5}
            value={data.profile.summary}
            onChange={(summary) => set('profile', { ...data.profile, summary })}
          />
          <MarkdownField
            label="Sobre mí (web)"
            rows={9}
            value={data.profile.about}
            onChange={(about) => set('profile', { ...data.profile, about })}
          />
        </>
      )}

      {tab === 'contact' && (
        <>
          <Field label="Teléfono" value={data.contact.phone} onChange={(phone) => set('contact', { ...data.contact, phone })} />
          <Field label="Correo" type="email" value={data.contact.email} onChange={(email) => set('contact', { ...data.contact, email })} />
          <Field label="LinkedIn" value={data.contact.linkedin} onChange={(linkedin) => set('contact', { ...data.contact, linkedin })} />
          <Field label="GitHub / repositorio" value={data.contact.github} onChange={(github) => set('contact', { ...data.contact, github })} />
          <Field label="Ubicación" value={data.contact.location} onChange={(location) => set('contact', { ...data.contact, location })} />
        </>
      )}

      {tab === 'experience' && (
        <>
          <Hint>Las experiencias consecutivas con la misma empresa se agrupan en el CV.</Hint>
          <ListEditor
            items={data.experience}
            onChange={(v) => set('experience', v)}
            create={() => ({ id: newId(), company: '', role: '', start: '', end: 'actual', description: '' })}
            title={(e) => `${e.company}${e.role ? ' · ' + e.role : ''}`}
            render={(e, up) => (
              <>
                <Field label="Empresa" value={e.company} onChange={(company) => up({ company })} />
                <Field label="Cargo" value={e.role} onChange={(role) => up({ role })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Inicio" placeholder="MM/AAAA" value={e.start} onChange={(start) => up({ start })} />
                  <Field label="Fin" placeholder="MM/AAAA o actual" value={e.end} onChange={(end) => up({ end })} />
                </div>
                <MarkdownField label="Logros / responsabilidades" value={e.description} onChange={(description) => up({ description })} />
              </>
            )}
          />
        </>
      )}

      {tab === 'education' && (
        <ListEditor
          items={data.education}
          onChange={(v) => set('education', v)}
          create={() => ({ id: newId(), title: '', kind: 'Curso', institution: '', description: '' })}
          title={(e) => e.title}
          render={(e, up) => (
            <>
              <Field label="Título" value={e.title} onChange={(title) => up({ title })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo" placeholder="Título, Curso…" value={e.kind} onChange={(kind) => up({ kind })} />
                <Field label="Institución" value={e.institution} onChange={(institution) => up({ institution })} />
              </div>
              <MarkdownField label="Detalle" rows={2} value={e.description} onChange={(description) => up({ description })} />
            </>
          )}
        />
      )}

      {tab === 'skills' && (
        <ListEditor
          items={data.skills}
          onChange={(v) => set('skills', v)}
          create={() => ({ id: newId(), category: '', items: '' })}
          title={(s) => s.category}
          render={(s, up) => (
            <>
              <Field label="Categoría" value={s.category} onChange={(category) => up({ category })} />
              <Field label="Tecnologías (separadas por coma)" value={s.items} onChange={(items) => up({ items })} />
            </>
          )}
        />
      )}

      {tab === 'projects' && (
        <ListEditor
          items={data.projects}
          onChange={(v) => set('projects', v)}
          create={() => ({ id: newId(), name: '', url: '', description: '' })}
          title={(p) => p.name}
          render={(p, up) => (
            <>
              <Field label="Nombre" value={p.name} onChange={(name) => up({ name })} />
              <Field label="URL" value={p.url} onChange={(url) => up({ url })} />
              <MarkdownField label="Descripción" value={p.description} onChange={(description) => up({ description })} />
            </>
          )}
        />
      )}

      {tab === 'extra' && (
        <>
          <h3 className="font-bold mb-2">Idiomas</h3>
          <ListEditor
            items={data.languages}
            onChange={(v) => set('languages', v)}
            create={() => ({ id: newId(), name: '', level: '' })}
            title={(l) => `${l.name} - ${l.level}`}
            render={(l, up) => (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Idioma" value={l.name} onChange={(name) => up({ name })} />
                <Field label="Nivel" value={l.level} onChange={(level) => up({ level })} />
              </div>
            )}
          />
          <h3 className="font-bold mt-6 mb-2">Hobbies</h3>
          <FieldPermsProvider value={toFieldPerms(levelOf('hobbies'))}>
          <MarkdownField
            label="Uno por línea"
            rows={4}
            value={data.hobbies.join('\n')}
            onChange={(v) => set('hobbies', v.split('\n'))}
          />
          </FieldPermsProvider>
        </>
      )}

      {tab === 'bot' && (
        <>
          <Field label="Nombre del bot" value={data.bot.name} onChange={(name) => set('bot', { ...data.bot, name })} />
          <MarkdownField label="Saludo inicial" rows={3} value={data.bot.greeting} onChange={(greeting) => set('bot', { ...data.bot, greeting })} />
          <Hint>
            El bot ya responde solo sobre tu experiencia, tecnologías, estudios, proyectos, idiomas y CV usando estos datos. Aquí
            agregas respuestas propias: si el visitante escribe alguna de las palabras clave, responde con tu texto.
          </Hint>
          <ListEditor
            items={data.bot.faqs}
            onChange={(faqs) => set('bot', { ...data.bot, faqs })}
            create={() => ({ id: newId(), question: '', keywords: '', answer: '' })}
            title={(f) => f.question}
            render={(f, up) => (
              <>
                <Field label="Pregunta (referencia)" value={f.question} onChange={(question) => up({ question })} />
                <Field
                  label="Palabras clave (separadas por coma)"
                  placeholder="salario, sueldo, pretensiones"
                  value={f.keywords}
                  onChange={(keywords) => up({ keywords })}
                />
                <MarkdownField label="Respuesta" value={f.answer} onChange={(answer) => up({ answer })} />
              </>
            )}
          />
        </>
      )}

      {tab === 'cv' && (
        <Hint>
          El diseño del CV (orden de bloques, columnas, títulos y color) se arma en la vista <strong>Constructor de CV</strong>.
        </Hint>
      )}
      </FieldPermsProvider>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs mb-3 p-2 rounded bg-primary/10 text-primary">
      <i className="fas fa-lightbulb mr-1" />
      {children}
    </p>
  );
}
