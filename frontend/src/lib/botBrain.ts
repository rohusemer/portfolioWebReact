// "Cerebro" del bot: responde con reglas y palabras clave usando los datos del
// portafolio. No usa IA ni servicios externos, así que es gratis e instantáneo.

import type { PortfolioData } from './types';
import type { GithubInfo, GithubRepo } from './github';

export type BotAction = 'contact' | 'cv';
export interface BotReply {
  text: string; // markdown
  action?: BotAction;
}

export const QUICK_REPLIES = [
  { label: '📄 Descargar CV', text: 'Quiero su CV' },
  { label: '👤 ¿Quién es Ronny?', text: '¿Quién es?' },
  { label: '💼 Experiencia', text: 'Experiencia' },
  { label: '🛠️ Tecnologías', text: 'Tecnologías' },
  { label: '💻 GitHub', text: '¿Qué tiene en GitHub?' },
  { label: '🎓 Estudios', text: 'Estudios' },
  { label: '✉️ Contactarlo', text: 'Quiero contactarlo' },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.#+-]/g, ' ');

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`(^|\\s)${w}`).test(text));

const firstName = (d: PortfolioData) => d.profile.name.split(/\s+/)[0];

/** Años de experiencia desde la fecha de inicio más antigua (formato MM/AAAA). */
export function yearsOfExperience(d: PortfolioData): number {
  const starts = d.experience
    .map((e) => e.start.match(/(\d{1,2})\/(\d{4})/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => new Date(Number(m[2]), Number(m[1]) - 1).getTime());
  if (!starts.length) return 0;
  return Math.floor((Date.now() - Math.min(...starts)) / (365.25 * 24 * 3600 * 1000));
}

function techList(d: PortfolioData): { name: string; group: string }[] {
  const out: { name: string; group: string }[] = [];
  for (const s of d.skills) for (const t of s.items.split(',')) t.trim() && out.push({ name: t.trim(), group: s.category });
  for (const t of d.profile.summary.replace(/[*_\n]/g, ' ').split(/[,.]/)) {
    const name = t.replace(/con experiencia en/i, '').trim();
    if (name && name.split(' ').length <= 2 && !out.some((o) => norm(o.name) === norm(name))) out.push({ name, group: 'Perfil' });
  }
  return out;
}

/** Líneas de contacto en Markdown (correo, teléfono/WhatsApp, LinkedIn, GitHub). */
export function contactLines(d: PortfolioData): string {
  const c = d.contact;
  const wa = c.phone.replace(/\D/g, '').replace(/^0/, '593');
  return [
    c.email && `✉️ [${c.email}](mailto:${c.email})`,
    c.phone && `📱 ${c.phone} · [WhatsApp](https://wa.me/${wa})`,
    c.linkedin && `💼 [LinkedIn](${c.linkedin})`,
    c.github && `💻 [GitHub](${c.github})`,
  ]
    .filter(Boolean)
    .join('  \n');
}

/** Mensajes con los que se abre el chat: saludo, contacto y el CV listo para descargar. */
export function openingMessages(d: PortfolioData): BotReply[] {
  const name = firstName(d);
  return [
    { text: d.bot.greeting },
    { text: `Puedes contactar a ${name} directamente:\n\n${contactLines(d)}` },
    { text: `📄 Aquí tienes el CV de ${name} listo para descargar:`, action: 'cv' },
    { text: 'También puedes preguntarme por su experiencia o tecnologías, o dejarle un mensaje desde aquí. 😊' },
  ];
}

const repoLine = (r: GithubRepo) =>
  `- [**${r.name}**](${r.url})${r.language ? ` · _${r.language}_` : ''}${r.stars ? ` · ⭐ ${r.stars}` : ''}${r.description ? `: ${r.description}` : ''}`;

function githubSummary(gh: GithubInfo, name: string): string {
  const langs = gh.languages.slice(0, 5).map((l) => `**${l.name}** (${l.count})`).join(', ');
  const top = gh.repos.slice(0, 5).map(repoLine).join('\n');
  return `${name} tiene **${gh.publicRepos} repositorios públicos** en [GitHub](${gh.profileUrl}).${
    langs ? `\n\nLenguajes que más usa: ${langs}.` : ''
  }${top ? `\n\nDestacados:\n${top}` : ''}`;
}

/** Repos de GitHub que usan una tecnología (por lenguaje, tema, nombre o descripción). */
function reposWith(gh: GithubInfo | null | undefined, tech: string): GithubRepo[] {
  if (!gh) return [];
  const t = norm(tech).trim();
  return gh.repos.filter(
    (r) => norm(r.language) === t || r.topics.some((x) => norm(x) === t) || ` ${norm(r.name)} ${norm(r.description)} `.includes(` ${t} `),
  );
}

export function reply(input: string, d: PortfolioData, gh?: GithubInfo | null): BotReply {
  const text = ` ${norm(input)} `;
  const name = firstName(d);

  // 1. Preguntas frecuentes personalizadas (editables desde /admin)
  for (const faq of d.bot.faqs) {
    const kws = faq.keywords.split(',').map((k) => norm(k).trim()).filter(Boolean);
    if (kws.length && has(text, kws)) return { text: faq.answer };
  }

  // 2. GitHub: repos, código, último proyecto
  if (gh && has(text, ['github', 'repositorio', 'repo', 'codigo', 'open source', 'commits'])) {
    return { text: githubSummary(gh, name) };
  }
  if (gh && has(text, ['ultimo', 'reciente', 'actualmente', 'trabajando'])) {
    const last = [...gh.repos].sort((a, b) => +new Date(b.pushedAt) - +new Date(a.pushedAt))[0];
    if (last)
      return {
        text: `Lo más reciente en su GitHub es ${repoLine(last).slice(2)} (actualizado el ${new Date(last.pushedAt).toLocaleDateString('es')}).`,
      };
  }

  // 3. ¿Sabe X tecnología?
  const techs = techList(d).filter((t) => {
    const n = norm(t.name).trim();
    return n.length > 1 && new RegExp(`(^|\\s)${n.replace(/[.+#]/g, '\\$&')}(\\s|$|\\?)`).test(text);
  });
  if (techs.length) {
    const list = techs.map((t) => `**${t.name}**`).join(', ');
    const repos = techs.flatMap((t) => reposWith(gh, t.name)).slice(0, 3);
    return {
      text: `¡Sí! ${name} tiene experiencia con ${list}.${
        repos.length ? `\n\nPuedes ver código en GitHub:\n${repos.map(repoLine).join('\n')}` : ''
      }\n\n¿Quieres contactarlo para una entrevista?`,
    };
  }
  // Tecnología que no está en el CV pero sí en sus repositorios
  if (gh) {
    const known = new Set([...gh.languages.map((l) => l.name), ...gh.repos.flatMap((r) => r.topics)]);
    const hit = [...known].find((k) => k.length > 1 && new RegExp(`(^|\\s)${norm(k).replace(/[.+#]/g, '\\$&')}(\\s|$|\\?)`).test(text));
    if (hit) {
      const repos = reposWith(gh, hit).slice(0, 3);
      return { text: `Sí, en su GitHub hay proyectos con **${hit}**:\n${repos.map(repoLine).join('\n')}` };
    }
  }

  if (has(text, ['hola', 'buenas', 'hey', 'hi', 'hello', 'saludos'])) {
    return { text: `¡Hola! 😊 ¿Qué te gustaría saber sobre ${name}?` };
  }
  if (has(text, ['gracias', 'thank', 'genial', 'perfecto', 'excelente'])) {
    return { text: '¡Con gusto! Si quieres, puedo ayudarte a dejarle un mensaje. 🙌' };
  }
  if (has(text, ['cv', 'curriculum', 'hoja de vida', 'resume', 'pdf', 'descargar'])) {
    return { text: `¡Claro! Aquí tienes el CV de ${name} en PDF 👇`, action: 'cv' };
  }
  if (has(text, ['contact', 'mensaje', 'escribir', 'llamar', 'telefono', 'correo', 'email', 'mail', 'whatsapp', 'entrevista', 'reunion'])) {
    return {
      text: `${contactLines(d)}\n\nO déjale un mensaje aquí mismo y le llegará directamente. Si lo necesitas, también puedo darte su **CV en PDF**.`,
      action: 'contact',
    };
  }
  if (has(text, ['experiencia', 'trabaj', 'empresa', 'empleo', 'cargo', 'puesto', 'laboral', 'experience', 'anos'])) {
    const years = yearsOfExperience(d);
    const items = d.experience.map((e) => `- **${e.role}** — ${e.company} _(${e.start} – ${e.end})_`).join('\n');
    return { text: `${name} tiene ${years > 0 ? `más de **${years} años** de` : ''} experiencia profesional:\n\n${items}` };
  }
  if (has(text, ['tecnolog', 'habilidad', 'skill', 'stack', 'lenguaje', 'programa', 'framework', 'sabe', 'conoce', 'herramienta'])) {
    const items = d.skills.map((s) => `- **${s.category}:** ${s.items}`).join('\n');
    return { text: `Estas son las tecnologías que domina ${name}:\n\n${items}\n\nPregúntame por una en concreto, por ejemplo: _¿sabe React?_` };
  }
  if (has(text, ['estudi', 'educacion', 'titulo', 'universidad', 'carrera', 'curso', 'certific', 'formacion'])) {
    const items = d.education.map((e) => `- **${e.title}** — ${e.kind}, ${e.institution}`).join('\n');
    return { text: `Formación de ${name}:\n\n${items}` };
  }
  if (has(text, ['proyecto', 'portafolio', 'portfolio', 'project', 'trabajos'])) {
    const items = d.projects.map((p) => `- ${p.url ? `[**${p.name}**](${p.url})` : `**${p.name}**`}: ${p.description}`).join('\n');
    const ghTop = gh?.repos.slice(0, 3).map(repoLine).join('\n');
    return { text: `Algunos proyectos de ${name}:\n\n${items}${ghTop ? `\n\nEn GitHub también tiene:\n${ghTop}` : ''}` };
  }
  if (has(text, ['idioma', 'ingles', 'english', 'espanol', 'language'])) {
    return { text: `Idiomas: ${d.languages.map((l) => `**${l.name}** (${l.level})`).join(', ')}.` };
  }
  if (has(text, ['quien', 'sobre', 'perfil', 'about', 'presenta', 'eres', 'es ronny'])) {
    return { text: `**${d.profile.name}** — ${d.profile.title}.\n\n${d.profile.summary}` };
  }

  return {
    text: `Mmm, no tengo esa respuesta 🤔. Puedes preguntarme por su **experiencia**, **tecnologías** o **estudios**, o dejarle un mensaje a ${name} y te responderá personalmente.`,
    action: 'contact',
  };
}
