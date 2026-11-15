// Información pública de GitHub para el bot (repositorios, lenguajes, temas).
// Usa la API pública sin token (60 peticiones/hora por visitante) y guarda el
// resultado en sessionStorage durante 1 hora para no repetir llamadas.

export interface GithubRepo {
  name: string;
  description: string;
  url: string;
  homepage: string;
  language: string;
  stars: number;
  topics: string[];
  pushedAt: string;
}

export interface GithubInfo {
  username: string;
  profileUrl: string;
  publicRepos: number;
  followers: number;
  bio: string;
  repos: GithubRepo[]; // propios (sin forks), ordenados por relevancia
  languages: { name: string; count: number }[];
}

const TTL = 60 * 60 * 1000;

/** Extrae el usuario de una URL como https://github.com/rohusemer */
export function githubUsername(url: string): string | null {
  const m = url.match(/github\.com\/([A-Za-z0-9-]{1,39})\/?$/i);
  return m ? m[1] : null;
}

export async function fetchGithubInfo(username: string): Promise<GithubInfo | null> {
  const key = `gh:${username}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (cached && Date.now() - cached.at < TTL) return cached.info;
  } catch {
    /* sin caché */
  }
  try {
    const headers = { Accept: 'application/vnd.github+json' };
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=pushed`, { headers }),
    ]);
    if (!userRes.ok || !reposRes.ok) return null;
    const user = await userRes.json();
    const raw: any[] = await reposRes.json();

    const repos: GithubRepo[] = raw
      .filter((r) => !r.fork && !r.archived)
      .map((r) => ({
        name: r.name,
        description: r.description ?? '',
        url: r.html_url,
        homepage: r.homepage ?? '',
        language: r.language ?? '',
        stars: r.stargazers_count ?? 0,
        topics: r.topics ?? [],
        pushedAt: r.pushed_at,
      }))
      .sort((a, b) => b.stars - a.stars || +new Date(b.pushedAt) - +new Date(a.pushedAt));

    const counts = new Map<string, number>();
    for (const r of repos) if (r.language) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    const languages = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const info: GithubInfo = {
      username,
      profileUrl: user.html_url,
      publicRepos: user.public_repos ?? repos.length,
      followers: user.followers ?? 0,
      bio: user.bio ?? '',
      repos,
      languages,
    };
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), info }));
    } catch {
      /* modo privado */
    }
    return info;
  } catch {
    return null;
  }
}
