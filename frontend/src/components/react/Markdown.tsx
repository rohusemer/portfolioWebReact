import { useMemo } from 'react';
import { renderMarkdown } from '../../lib/markdown';

interface Props {
  source: string;
  className?: string;
}

export default function Markdown({ source, className }: Props) {
  const html = useMemo(() => renderMarkdown(source), [source]);
  return <div className={`md ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
