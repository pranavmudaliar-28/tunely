'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export interface ComboOption {
  id: string;
  name: string;
  count: number;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Options to show for a search: A–Z, names starting with the search before ones that only contain it, ignoring case
 * and accents. The selected option is always kept so the viewer can see what's applied.
 */
export function filterOptions(options: ComboOption[], query: string, selected?: string): ComboOption[] {
  const q = norm(query.trim());
  const byName = (a: ComboOption, b: ComboOption) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  if (!q) return [...options].sort(byName);
  const starts: ComboOption[] = [];
  const contains: ComboOption[] = [];
  for (const o of options) {
    const n = norm(o.name);
    if (n.startsWith(q)) starts.push(o);
    else if (n.includes(q) || o.id === selected) contains.push(o);
  }
  return [...starts.sort(byName), ...contains.sort(byName)];
}

/** A select with a search box, for long option lists (≈230 countries). Keyboard: type, ↑/↓, Enter, Escape. */
export function FacetCombobox({
  id,
  label,
  all,
  value,
  valueName,
  options,
  onChange,
}: {
  id: string;
  label: string;
  /** The "no filter" option, e.g. "All countries". */
  all: string;
  value?: string;
  /** Display name of the selected value (it may have no count under the current filters). */
  valueName?: string;
  options: ComboOption[];
  onChange(v?: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const withSelected = useMemo(
    () =>
      value && !options.some((o) => o.id === value)
        ? [...options, { id: value, name: valueName ?? value, count: 0 }]
        : options,
    [options, value, valueName],
  );
  const shown = useMemo(
    () => [
      ...(query.trim() ? [] : [{ id: '', name: all, count: -1 }]),
      ...filterOptions(withSelected, query, value),
    ],
    [withSelected, query, all, value],
  );

  const close = (focusTrigger: boolean) => {
    setOpen(false);
    setQuery('');
    if (focusTrigger) trigger.current?.focus();
  };
  const choose = (o: ComboOption | undefined) => {
    if (!o) return;
    onChange(o.id || undefined);
    close(true);
  };
  const openList = () => {
    const i = shown.findIndex((o) => o.id === (value ?? ''));
    setActive(Math.max(0, i));
    setOpen(true);
  };

  // Clicking anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current?.contains(e.target as Node)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open)
      listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const current = value ? (withSelected.find((o) => o.id === value)?.name ?? valueName ?? value) : all;
  const fmt = (n: number) => n.toLocaleString('en');

  return (
    <div ref={root} className="relative flex min-w-0 flex-col gap-1.5">
      <label id={`${id}-label`} htmlFor={id} className="text-text-muted text-xs font-medium">
        {label}
      </label>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
        className="border-border bg-bg flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-[8px] border px-2.5 text-left text-sm"
      >
        <span className="truncate">{current}</span>
        <ChevronDown size={16} className="text-text-muted shrink-0" />
      </button>

      {open && (
        <div className="border-border bg-surface-raised absolute top-full right-0 left-0 z-40 mt-1 flex min-w-[min(260px,calc(100vw-48px))] flex-col overflow-hidden rounded-[10px] border shadow-2xl shadow-black/50">
          <input
            autoFocus
            role="combobox"
            aria-label={`Search ${label.toLowerCase()}`}
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            value={query}
            placeholder={`Search ${label.toLowerCase()}…`}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, shown.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault(); // Don't submit the search form.
                choose(shown[active]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                close(true);
              } else if (e.key === 'Tab') {
                close(false);
              }
            }}
            className="border-border bg-bg m-2 h-10 rounded-[8px] border px-3 text-sm"
          />
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="max-h-[min(50vh,320px)] overflow-y-auto px-1 pb-1"
          >
            {shown.length === 0 && <li className="text-text-muted px-3 py-2.5 text-sm">No matches</li>}
            {shown.map((o, i) => {
              const selected = (value ?? '') === o.id;
              return (
                <li
                  key={o.id || 'all'}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  // Keep focus in the search box while clicking.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                  onPointerMove={() => setActive(i)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-3 rounded-[6px] px-3 py-2.5 text-sm',
                    i === active && 'bg-surface text-text',
                    selected && 'font-semibold',
                  )}
                >
                  <span className="truncate">{o.name}</span>
                  {o.count >= 0 && (
                    <span className="text-text-muted shrink-0 tabular-nums">{fmt(o.count)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
