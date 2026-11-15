// Modelo de datos del portafolio. Se guarda completo en Firestore en el
// documento `portfolio/main`. Los campos marcados como "markdown" se
// renderizan con Markdown tanto en la web como en el CV.

export interface Profile {
  name: string;
  title: string; // Ej: "Ingeniero en Ciencias de la Computación"
  photoUrl: string;
  /** markdown — resumen corto (barra lateral del CV) */
  summary: string;
  /** markdown — texto "Sobre mí" de la web */
  about: string;
}

export interface Contact {
  phone: string;
  email: string;
  linkedin: string;
  github: string;
  location: string;
}

export interface SkillGroup {
  id: string;
  category: string;
  items: string; // separado por comas
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  start: string; // "MM/AAAA"
  end: string; // "MM/AAAA" o "actual"
  /** markdown */
  description: string;
}

export interface EducationItem {
  id: string;
  title: string;
  kind: string; // "Título", "Curso", "Certificación"...
  institution: string;
  /** markdown */
  description: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  url: string;
  /** markdown */
  description: string;
}

export interface LanguageItem {
  id: string;
  name: string;
  level: string;
}

/** Bloques que se pueden colocar en el CV. Los personalizados usan el id "custom:<id>". */
export const BASE_BLOCKS = [
  'photo',
  'summary',
  'contact',
  'languages',
  'skills',
  'hobbies',
  'experience',
  'education',
  'projects',
] as const;
export type BaseBlock = (typeof BASE_BLOCKS)[number];

export const DEFAULT_BLOCK_TITLES: Record<BaseBlock, string> = {
  photo: 'Foto',
  summary: 'Perfil',
  contact: 'Contacto',
  languages: 'Idiomas',
  skills: 'Habilidades',
  hobbies: 'Hobbies',
  experience: 'Experiencia laboral',
  education: 'Estudios',
  projects: 'Proyectos',
};

export interface CustomBlock {
  id: string;
  title: string;
  /** markdown */
  body: string;
}

export type CvColumn = 'sidebar' | 'main';

export interface CvLayout {
  sidebar: string[];
  main: string[];
}

export interface CvSettings {
  accentColor: string;
  layout: CvLayout;
  /** títulos personalizados por bloque */
  titles: Record<string, string>;
  custom: CustomBlock[];
}

/** Metadatos del PDF publicado que entrega el bot. */
export interface CvPdfMeta {
  fileName: string;
  publishedAt: string;
  chunks: number;
  size: number;
}

export interface BotFaq {
  id: string;
  question: string;
  /** palabras clave separadas por coma para reconocer la pregunta */
  keywords: string;
  /** markdown */
  answer: string;
}

export interface BotSettings {
  name: string;
  greeting: string;
  faqs: BotFaq[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface PortfolioData {
  profile: Profile;
  contact: Contact;
  skills: SkillGroup[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  languages: LanguageItem[];
  hobbies: string[];
  cv: CvSettings;
  bot: BotSettings;
  /** CV personal: visible en /perfil?u=<uid> (solo premium/editor/owner) */
  isPublic?: boolean;
  updatedAt?: string;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
