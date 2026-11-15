// "Cerebro" del bot: responde con reglas y palabras clave usando los datos del
// portafolio. No usa IA ni servicios externos, así que es gratis e instantáneo.

import type { PortfolioData } from './types';

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

export function reply(input: string, d: PortfolioData): BotReply {
  const text = ` ${norm(input)} `;
  const name = firstName(d);

  // 1. Preguntas frecuentes personalizadas (editables desde /admin)
  for (const faq of d.bot.faqs) {
    const kws = faq.keywords.split(',').map((k) => norm(k).trim()).filter(Boolean);
    if (kws.length && has(text, kws)) return { text: faq.answer };
  }

  // 2. ¿Sabe X tecnología?
  const techs = techList(d).filter((t) => {
    const n = norm(t.name).trim();
    return n.length > 1 && new RegExp(`(^|\\s)${n.replace(/[.+#]/g, '\\$&')}(\\s|$|\\?)`).test(text);
  });
  if (techs.length) {
    const list = techs.map((t) => `**${t.name}**`).join(', ');
    return {
      text: `¡Sí! ${name} tiene experiencia con ${list}. ¿Quieres conocer sus proyectos o contactarlo para una entrevista?`,
    };
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
    return { text: `Algunos proyectos de ${name}:\n\n${items}` };
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
