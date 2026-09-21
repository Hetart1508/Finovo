import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const renderedElements = useMemo(() => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableHeader: string[] = [];
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushTable = (key: string) => {
      if (tableHeader.length > 0 || tableRows.length > 0) {
        elements.push(
          <div key={key} className="my-2.5 overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full border-collapse text-left text-xs">
              {tableHeader.length > 0 && (
                <thead className="bg-muted/60 text-foreground font-semibold">
                  <tr>
                    {tableHeader.map((h, idx) => (
                      <th key={idx} className="border-b border-border p-2 font-semibold">
                        {renderInline(h.trim())}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-border/60">
                {tableRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-muted/20">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-2 text-foreground">
                        {renderInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      inTable = false;
      tableHeader = [];
      tableRows = [];
    };

    const flushCode = (key: string) => {
      if (codeLines.length > 0) {
        elements.push(
          <pre key={key} className="my-2.5 overflow-x-auto rounded-lg bg-muted/90 p-3 text-xs font-mono text-foreground">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
      }
      inCodeBlock = false;
      codeLines = [];
    };

    const renderInline = (text: string): React.ReactNode => {
      // Inline code
      const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
      return parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
          return (
            <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.78rem] text-[#4F9CF9]">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
          return <em key={i} className="italic text-muted-foreground">{part.slice(1, -1)}</em>;
        }
        return part;
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code blocks
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          flushCode(`code-${i}`);
        } else {
          if (inTable) flushTable(`tbl-${i}`);
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Markdown Tables
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        // Check if separator line (|---|---|)
        if (cells.every((c) => /^:?-+:?$/.test(c))) {
          continue;
        }

        if (!inTable) {
          inTable = true;
          tableHeader = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else if (inTable) {
        flushTable(`tbl-${i}`);
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-foreground">
            {renderInline(trimmed.slice(4))}
          </h4>
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={i} className="mt-3.5 mb-1.5 text-sm font-bold text-foreground">
            {renderInline(trimmed.slice(3))}
          </h3>
        );
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={i} className="mt-4 mb-2 text-base font-bold text-foreground">
            {renderInline(trimmed.slice(2))}
          </h2>
        );
        continue;
      }

      // Bullet lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={i} className="ml-4 list-disc text-xs leading-relaxed text-foreground">
            {renderInline(trimmed.slice(2))}
          </li>
        );
        continue;
      }

      // Numbered lists
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={i} className="ml-1 flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
            <span className="font-semibold text-muted-foreground">{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Blockquotes / Disclaimers
      if (trimmed.startsWith('> ') || trimmed.startsWith('*Disclaimer:')) {
        elements.push(
          <blockquote key={i} className="my-2 border-l-2 border-[#4F9CF9]/60 pl-3 italic text-[0.72rem] text-muted-foreground">
            {renderInline(trimmed.replace(/^>\s*/, ''))}
          </blockquote>
        );
        continue;
      }

      // Paragraphs
      if (trimmed) {
        elements.push(
          <p key={i} className="text-xs leading-relaxed text-foreground">
            {renderInline(trimmed)}
          </p>
        );
      } else {
        elements.push(<div key={i} className="h-1.5" />);
      }
    }

    if (inTable) flushTable('tbl-end');
    if (inCodeBlock) flushCode('code-end');

    return elements;
  }, [content]);

  return <div className={`space-y-1.5 break-words ${className}`}>{renderedElements}</div>;
}
