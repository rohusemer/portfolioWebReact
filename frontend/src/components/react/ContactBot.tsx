import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PortfolioData } from '../../lib/types';
import { downloadPublishedCv, fetchCvPdfMeta, firebaseConfigured, loadPortfolioOnce, sendContactMessage } from '../../lib/firebase';
import type { CvPdfMeta } from '../../lib/types';
import { QUICK_REPLIES, openingMessages, reply, type BotAction } from '../../lib/botBrain';
import { renderMarkdown } from '../../lib/markdown';

interface Msg {
  from: 'bot' | 'user';
  text: string;
  action?: BotAction;
}

export default function ContactBot({ initialData }: { initialData: PortfolioData }) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPortfolioOnce().then((d) => d && setData(d));
    const t = setTimeout(() => setTeaser(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Al abrir: saludo, datos de contacto y el CV, apareciendo uno tras otro
  useEffect(() => {
    if (!open || msgs.length > 0) return;
    const opening = openingMessages(data);
    setMsgs([{ from: 'bot', ...opening[0] }]);
    const timers = opening.slice(1).map((m, i) =>
      setTimeout(() => setMsgs((prev) => [...prev, { from: 'bot', ...m }]), 500 * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [open]);

  const lastContactIdx = msgs.map((m) => m.action).lastIndexOf('contact');

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, typing]);

  const ask = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { from: 'user', text }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      const r = reply(text, data);
      setMsgs((m) => [...m, { from: 'bot', text: r.text, action: r.action }]);
      setTyping(false);
    }, 450);
  };

  const onDownloaded = () =>
    setTimeout(
      () =>
        setMsgs((m) => [
          ...m,
          {
            from: 'bot',
            text: `¡Listo! 📄 ¿Te gustaría agendar una entrevista o hacerle una propuesta a ${data.profile.name.split(' ')[0]}? Déjale tus datos:`,
            action: 'contact',
          },
        ]),
      900,
    );

  const onSent = (name: string) =>
    setMsgs((m) => [
      ...m,
      { from: 'bot', text: `¡Gracias, ${name}! ✅ Tu mensaje llegó a ${data.profile.name.split(' ')[0]}. Te responderá muy pronto.` },
    ]);

  return (
    <div className="fixed right-4 md:right-8 bottom-24 z-50 flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm h-[min(560px,70vh)] flex flex-col rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden text-dark-text dark:text-light-text">
          <header className="flex items-center gap-3 px-4 py-3 bg-primary text-white">
            <span className="w-9 h-9 rounded-full bg-white/20 grid place-items-center">
              <i className="fas fa-robot" />
            </span>
            <div className="flex-1">
              <div className="font-bold leading-tight">{data.bot.name}</div>
              <div className="text-xs opacity-80">Asistente de {data.profile.name}</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="w-8 h-8 rounded-full hover:bg-white/20">
              <i className="fas fa-xmark" />
            </button>
          </header>

          <div ref={scroller} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.from === 'user' ? 'bg-primary text-white rounded-br-sm' : 'bg-neutral-100 dark:bg-neutral-800 rounded-bl-sm'
                  }`}
                >
                  {m.from === 'bot' ? <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} /> : m.text}
                  {m.action === 'cv' && <CvDownload onDone={onDownloaded} />}
                  {m.action === 'contact' && i === lastContactIdx && (
                    <ContactForm email={data.contact.email} onSent={onSent} />
                  )}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex">
                <div className="rounded-2xl px-3 py-2 bg-neutral-100 dark:bg-neutral-800 animate-pulse">…</div>
              </div>
            )}
          </div>

          <div className="px-3 pt-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {QUICK_REPLIES.map((q) => (
              <button
                key={q.label}
                onClick={() => ask(q.text)}
                className="shrink-0 text-xs rounded-full border border-primary/50 text-primary px-2.5 py-1 hover:bg-primary hover:text-white"
              >
                {q.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              className="flex-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-transparent px-4 py-2 text-sm"
            />
            <button type="submit" aria-label="Enviar" className="w-10 h-10 rounded-full bg-primary text-white hover:bg-accent">
              <i className="fas fa-paper-plane" />
            </button>
          </form>
        </div>
      )}

      {!open && teaser && (
        <button
          onClick={() => setOpen(true)}
          className="mb-2 max-w-[220px] text-left text-sm rounded-2xl rounded-br-sm px-3 py-2 shadow-lg bg-white dark:bg-neutral-900 border border-primary text-dark-text dark:text-light-text"
        >
          ¿Buscas talento? 👋 Pídeme el CV de {data.profile.name.split(' ')[0]} 📄
        </button>
      )}

      <button
        onClick={() => {
          setOpen(!open);
          setTeaser(false);
        }}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        className="w-14 h-14 rounded-full bg-primary text-white shadow-xl grid place-items-center hover:bg-accent transition-transform hover:scale-110"
      >
        <i className={`fas ${open ? 'fa-xmark' : 'fa-robot'} text-2xl`} />
      </button>
    </div>
  );
}

function ContactForm({ email, onSent }: { email: string; onSent: (name: string) => void }) {
  const [f, setF] = useState({ name: '', email: '', company: '', message: '', website: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!firebaseConfigured) {
    return (
      <a href={`mailto:${email}`} className="mt-2 inline-block rounded-lg bg-primary text-white px-3 py-1.5 font-semibold">
        Enviar correo
      </a>
    );
  }
  if (state === 'sent') return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.website) return; // trampa para bots de spam
    setState('sending');
    try {
      await sendContactMessage(f);
      setState('sent');
      onSent(f.name.split(' ')[0]);
    } catch (err) {
      console.error(err);
      setState('error');
    }
  };

  const cls = 'w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm';
  return (
    <form onSubmit={submit} className="mt-2 space-y-1.5">
      <input required maxLength={100} placeholder="Tu nombre *" className={cls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input required type="email" maxLength={150} placeholder="Tu correo *" className={cls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input maxLength={100} placeholder="Empresa (opcional)" className={cls} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
      <textarea required maxLength={2000} rows={3} placeholder="Mensaje *" className={cls} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <input tabIndex={-1} autoComplete="off" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden="true" />
      {state === 'error' && <p className="text-xs text-red-500">No se pudo enviar. Intenta de nuevo o escribe a {email}.</p>}
      <button disabled={state === 'sending'} className="w-full rounded-lg bg-primary text-white py-1.5 font-semibold hover:bg-accent disabled:opacity-50">
        {state === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
      </button>
    </form>
  );
}

/** Botón que entrega el PDF publicado desde el constructor de CV. */
function CvDownload({ onDone }: { onDone: () => void }) {
  const [meta, setMeta] = useState<CvPdfMeta | null | undefined>(undefined);
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    fetchCvPdfMeta().then(setMeta);
  }, []);

  if (meta === undefined) return <p className="mt-2 text-xs opacity-60">Buscando el CV…</p>;

  if (!meta) {
    return (
      <a href="/cv" className="mt-2 inline-block rounded-lg bg-primary text-white px-3 py-1.5 font-semibold">
        <i className="fas fa-file-pdf mr-1" /> Abrir CV
      </a>
    );
  }

  const download = async () => {
    setState('loading');
    const ok = await downloadPublishedCv().catch(() => false);
    if (!ok) {
      window.location.href = '/cv';
      return;
    }
    setState('done');
    onDone();
  };

  return (
    <div className="mt-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 p-2.5">
      <div className="flex items-center gap-2">
        <i className="fas fa-file-pdf text-2xl text-red-500" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate">{meta.fileName}</div>
          <div className="text-[10px] opacity-60">
            PDF · {Math.round(meta.size / 1024)} KB · actualizado {new Date(meta.publishedAt).toLocaleDateString('es')}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={download}
          disabled={state === 'loading'}
          className="flex-1 rounded-lg bg-primary text-white px-2 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
        >
          <i className={`fas ${state === 'loading' ? 'fa-spinner fa-spin' : state === 'done' ? 'fa-check' : 'fa-download'} mr-1`} />
          {state === 'done' ? 'Descargado' : 'Descargar'}
        </button>
        <a href="/cv" className="rounded-lg border border-primary text-primary px-2 py-1.5 text-xs font-semibold">
          Ver en línea
        </a>
      </div>
    </div>
  );
}
