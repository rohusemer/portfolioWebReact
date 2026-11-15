// Solo se usa al construir el sitio (Astro, en el servidor). Lee el portafolio
// publicado desde la API REST de Firestore (lectura pública) para que el HTML
// estático —lo que ven Google, LinkedIn y quien abre el enlace— tenga el
// contenido real que editaste en el panel, y no solo la semilla del repositorio.
import type { PortfolioData } from './types';
import { seedData, withDefaults } from './firebase';

type FsValue = {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  nullValue?: null;
  timestampValue?: string;
  arrayValue?: { values?: FsValue[] };
  mapValue?: { fields?: Record<string, FsValue> };
};

/** Convierte el formato tipado de la API REST de Firestore en JSON normal. */
function decode(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map(decode);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]));
  return null;
}

let cached: Promise<PortfolioData> | null = null;

export function getBuildData(): Promise<PortfolioData> {
  return (cached ??= (async () => {
    const project = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!project) return seedData;
    try {
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/portfolio/main`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { fields?: Record<string, FsValue> };
      const data = decode({ mapValue: { fields: json.fields } }) as PortfolioData;
      console.log('[build] Portafolio cargado desde Firestore');
      return withDefaults(data);
    } catch (e) {
      console.warn('[build] No se pudo leer Firestore, se usa la semilla:', (e as Error).message);
      return seedData;
    }
  })());
}
