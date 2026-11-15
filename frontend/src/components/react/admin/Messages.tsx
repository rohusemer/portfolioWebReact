import { useEffect, useState } from 'react';
import type { ContactMessage } from '../../../lib/types';
import { deleteContactMessage, listContactMessages, markMessageRead } from '../../../lib/firebase';

/** Bandeja de mensajes que dejan los visitantes a través del bot. */
export default function Messages({ onUnread }: { onUnread?: (n: number) => void }) {
  const [msgs, setMsgs] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    listContactMessages()
      .then(setMsgs)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (msgs) onUnread?.(msgs.filter((m) => !m.read).length);
  }, [msgs]);

  const toggleRead = async (m: ContactMessage) => {
    await markMessageRead(m.id, !m.read);
    setMsgs((all) => all!.map((x) => (x.id === m.id ? { ...x, read: !m.read } : x)));
  };

  const remove = async (m: ContactMessage) => {
    if (!confirm(`¿Eliminar el mensaje de ${m.name}?`)) return;
    await deleteContactMessage(m.id);
    setMsgs((all) => all!.filter((x) => x.id !== m.id));
  };

  if (error) return <p className="text-red-500 text-sm">Error al cargar mensajes: {error}</p>;
  if (!msgs) return <p className="text-sm opacity-70">Cargando mensajes…</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <h2 className="flex-1 text-xl font-bold">
          Mensajes de contacto <span className="text-sm opacity-60">({msgs.length})</span>
        </h2>
        <button onClick={load} className="text-sm px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800">
          <i className="fas fa-rotate mr-1" /> Actualizar
        </button>
      </div>
      {msgs.length === 0 && (
        <p className="text-sm opacity-70 text-center py-12">
          <i className="fas fa-inbox text-3xl block mb-2" />
          Aún no hay mensajes. Cuando un reclutador te escriba desde el bot, aparecerá aquí.
        </p>
      )}
      <ul className="space-y-3">
        {msgs.map((m) => (
          <li
            key={m.id}
            className={`rounded-xl p-4 border ${
              m.read ? 'border-neutral-300 dark:border-neutral-800 opacity-75' : 'border-primary bg-primary/5'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 mb-1">
              {!m.read && <span className="w-2 h-2 rounded-full bg-primary self-center" />}
              <strong>{m.name}</strong>
              {m.company && <span className="text-sm opacity-70">· {m.company}</span>}
              <span className="flex-1" />
              <time className="text-xs opacity-60">{new Date(m.createdAt).toLocaleString('es')}</time>
            </div>
            <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
              {m.email}
            </a>
            <p className="mt-2 text-sm whitespace-pre-wrap">{m.message}</p>
            <div className="flex gap-2 mt-3 text-xs">
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent('Re: tu mensaje en mi portafolio')}`}
                className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold"
              >
                <i className="fas fa-reply mr-1" /> Responder
              </a>
              <button onClick={() => toggleRead(m)} className="px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800">
                {m.read ? 'Marcar no leído' : 'Marcar leído'}
              </button>
              <button onClick={() => remove(m)} className="px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10">
                <i className="fas fa-trash" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
