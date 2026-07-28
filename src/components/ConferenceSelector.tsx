import { useEffect, useMemo, useRef, useState } from 'react';
import { ConferenceLogo } from './ConferenceLogo';
import { GROUP_ORDER, GROUP_LABELS, conferenceGroup } from '../utils/conferenceGroups';
import type { ConferenceMetadata } from '../types';

interface ConferenceSelectorProps {
  conferences: string[];
  selected: string;
  onChange: (conference: string) => void;
  conferenceNames?: Record<string, ConferenceMetadata>;
}

interface ConferenceOption {
  code: string;
  displayName: string;
  abbreviation: string;
  meta?: ConferenceMetadata;
}

export function ConferenceSelector({
  conferences,
  selected,
  onChange,
  conferenceNames,
}: ConferenceSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo<ConferenceOption[]>(
    () =>
      conferences.map((code) => {
        const meta = conferenceNames?.[code];
        return {
          code,
          displayName: meta?.display_name ?? code,
          abbreviation: meta?.abbreviation ?? code,
          meta,
        };
      }),
    [conferences, conferenceNames],
  );

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, ConferenceOption[]>();
    for (const opt of options) {
      const group = conferenceGroup(opt.code);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(opt);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      options: groups.get(g)!,
    }));
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const scored = options
      .map((opt) => {
        const name = opt.displayName.toLowerCase();
        const abbr = opt.abbreviation.toLowerCase();
        const code = opt.code.toLowerCase();
        let score = -1;
        if (name.startsWith(q) || abbr.startsWith(q) || code.startsWith(q)) score = 0;
        else if (name.includes(q) || abbr.includes(q) || code.includes(q)) score = 1;
        return { opt, score };
      })
      .filter((s) => s.score >= 0)
      .sort((a, b) => a.score - b.score || a.opt.displayName.localeCompare(b.opt.displayName));
    return scored.map((s) => s.opt);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      // Focus after the popover mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function handleSelect(code: string) {
    onChange(code);
    setOpen(false);
    setQuery('');
  }

  function renderRow(opt: ConferenceOption) {
    return (
      <button
        key={opt.code}
        onClick={() => handleSelect(opt.code)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors ${
          opt.code === selected
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
        }`}
      >
        <ConferenceLogo conference={opt.code} meta={opt.meta} size="sm" className="shrink-0" />
        <span className="truncate">{opt.displayName}</span>
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-block w-full sm:w-80">
      <button
        onClick={() => {
          setQuery('');
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ConferenceLogo conference={selected} meta={conferenceNames?.[selected]} size="sm" className="shrink-0" />
          <span className="truncate">Switch conference...</span>
        </span>
        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full sm:w-96 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-2 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5" role="listbox">
            {filteredOptions ? (
              filteredOptions.length > 0 ? (
                filteredOptions.map(renderRow)
              ) : (
                <p className="px-3 py-4 text-sm text-center text-gray-400 dark:text-gray-500">No matches</p>
              )
            ) : (
              groupedOptions.map(({ group, label, options: groupOptions }, idx) => (
                <div key={group} className={idx > 0 ? 'mt-2 pt-2 border-t border-gray-100 dark:border-gray-700' : ''}>
                  <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 sticky top-0 bg-white dark:bg-gray-800">
                    {label}
                  </div>
                  {groupOptions.map(renderRow)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
