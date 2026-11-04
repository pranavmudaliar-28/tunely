'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ChannelCard } from '@/components/channel/channel-card';
import { createFolder, deleteFolder, FOLDER_LIMIT, renameFolder, useLibrary } from '@/lib/storage/library';
import { cn } from '@/lib/utils';
import { FolderNameField, FolderPicker } from './folder-picker';

export function FavoritesView() {
  const { favorites, folders } = useLibrary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'new' | 'rename' | null>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  // A deleted folder falls back to All.
  const folder = folders.find((f) => f.id === selectedId) ?? null;
  /** Leaves the name field and focuses the selected chip: the field is gone, so focus would fall to <body>. */
  const finish = (selected: string | null) => {
    flushSync(() => {
      setSelectedId(selected);
      setEditing(null);
    });
    toolbar.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  };

  if (!favorites.length) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-[12px] border p-10 text-center">
        <p className="text-lg font-semibold">No favorites yet</p>
        <p className="text-text-muted text-sm">Tap the heart on any channel to keep it here.</p>
        <Link
          href="/browse"
          className="bg-surface-raised text-text mt-2 flex h-11 items-center rounded-[8px] px-5 text-sm font-semibold no-underline"
        >
          Browse channels
        </Link>
      </div>
    );
  }

  const shown = folder ? favorites.filter((c) => folder.channelIds.includes(c.id)) : favorites;
  const chip = (pressed: boolean) =>
    cn(
      'flex h-10 items-center rounded-full border px-4 text-sm font-semibold',
      pressed ? 'bg-text text-bg border-transparent' : 'border-border text-text-muted hover:text-text',
    );

  return (
    <div className="flex flex-col gap-5">
      <div
        ref={toolbar}
        role="toolbar"
        aria-label="Favorite folders"
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          aria-pressed={!folder}
          onClick={() => setSelectedId(null)}
          className={chip(!folder)}
        >
          All ({favorites.length})
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === folder?.id}
            onClick={() => {
              setSelectedId(f.id);
              setEditing(null);
            }}
            className={chip(f.id === folder?.id)}
          >
            {f.name} ({f.channelIds.length})
          </button>
        ))}
        {editing === 'new' ? (
          <FolderNameField
            submitLabel="Create"
            onCancel={() => finish(selectedId)}
            onSave={async (name) => {
              const id = await createFolder(name);
              if (!id) return name.trim() ? `You can have up to ${FOLDER_LIMIT} folders.` : 'Type a name.';
              finish(id);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditing('new')} className={chip(false)}>
            + New folder
          </button>
        )}
      </div>

      {folder &&
        (editing === 'rename' ? (
          <FolderNameField
            initial={folder.name}
            submitLabel="Save"
            onCancel={() => finish(folder.id)}
            onSave={async (name) => {
              if (!(await renameFolder(folder.id, name))) {
                return name.trim() ? 'Another folder already has that name.' : 'Type a name.';
              }
              finish(folder.id);
            }}
          />
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={() => setEditing('rename')} className="text-text-muted underline">
              Rename folder
            </button>
            <button
              type="button"
              onClick={async () => {
                if (
                  window.confirm(`Delete the folder "${folder.name}"? Its channels stay in your favorites.`)
                ) {
                  await deleteFolder(folder.id);
                  finish(null);
                }
              }}
              className="text-text-muted underline"
            >
              Delete folder
            </button>
          </div>
        ))}

      {shown.length ? (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <ChannelCard channel={c} lineup={shown} variant="grid" />
              <FolderPicker channel={c} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted border-border rounded-[12px] border p-8 text-center text-sm">
          No channels in this folder yet. Use &quot;Add to folder&quot; under a channel in All to add one.
        </p>
      )}
    </div>
  );
}
