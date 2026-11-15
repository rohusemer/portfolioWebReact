import type { PortfolioData } from './types';

/** Exporta el CV completo como un documento Markdown (útil para LinkedIn, GitHub, ATS…). */
export function toMarkdown(d: PortfolioData): string {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(`# ${d.profile.name}`, `**${d.profile.title}**`, '');
  const contact = [
    d.contact.email && `✉️ ${d.contact.email}`,
    d.contact.phone && `📞 ${d.contact.phone}`,
    d.contact.location && `📍 ${d.contact.location}`,
    d.contact.linkedin && `[LinkedIn](${d.contact.linkedin})`,
    d.contact.github && `[GitHub](${d.contact.github})`,
  ].filter(Boolean);
  push(contact.join(' · '), '');

  push('## Perfil', d.profile.summary, '');

  push('## Experiencia laboral', '');
  for (const e of d.experience) {
    push(`### ${e.role} — ${e.company}`, `*${e.start} – ${e.end}*`, '', e.description, '');
  }

  push('## Estudios', '');
  for (const e of d.education) {
    push(`### ${e.title}`, `${e.kind}, ${e.institution}`, '');
    if (e.description) push(e.description, '');
  }

  if (d.skills.length) {
    push('## Habilidades', '');
    for (const s of d.skills) push(`- **${s.category}:** ${s.items}`);
    push('');
  }

  if (d.projects.length) {
    push('## Proyectos', '');
    for (const p of d.projects) {
      push(`### ${p.url ? `[${p.name}](${p.url})` : p.name}`, p.description, '');
    }
  }

  if (d.languages.length) {
    push('## Idiomas', '');
    for (const l of d.languages) push(`- ${l.name} — ${l.level}`);
    push('');
  }

  if (d.hobbies.length) {
    push('## Hobbies', '');
    for (const h of d.hobbies) push(`- ${h}`);
    push('');
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function downloadFile(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

export const cvFileBase = (d: PortfolioData) =>
  `CV_${d.profile.name.trim().split(/\s+/).reverse().join('')}`.replace(/[^\w-]/g, '');
