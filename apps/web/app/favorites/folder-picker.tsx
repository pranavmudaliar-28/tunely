'use client';

import type { ChannelSummary } from '@tunely/shared';
import { useId, useRef, useState } from 'react';
import { FolderIcon } from '@/components/ui/icons';
import {
  createFolder,
  FOLDER_LIMIT,
  FOLDER_NAME_MAX,
  toggleInFolder,
  useLibrary,
} from '@/lib/storage/library';

/** One-line form for a folder name: Enter saves, Escape cancels. */
export function FolderNameField({
  initial = '',
  submitLabel,
  onSave,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  /** Returns an error message to show, or nothing on success. */
  onSave(name: string): Promise<string | void>;
  onCancel(): void;
}) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState('');
  const errorId = useId();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const problem = await onSave(name);
        if (problem) setError(problem);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onCancel();
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={FOLDER_NAME_MAX}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        aria-label="Folder name"
        aria-describedby={error ? errorId : undefined}
        placeholder="Folder name, e.g. News"
        className="border-border bg-bg h-10 w-48 rounded-[8px] border px-3 text-sm"
      />
      <button type="submit" className="bg-text text-bg h-10 rounded-[8px] px-4 text-sm font-semibold">
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel} className="text-text-muted h-10 px-2 text-sm underline">
        Cancel
      </button>
      {error && (
        <p id={errorId} role="alert" className="text-warning w-full text-[13px]">
          {error}
        </p>
      )}
    </form>
  );
}

/** "Add to folder" under a favorite: a checkbox per folder, plus a way to make a new one. */
export function FolderPicker({ channel }: { channel: ChannelSummary }) {
  const { folders } = useLibrary();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const inCount = folders.filter((f) => f.channelIds.includes(channel.id)).length;
  const label = inCount ? `In ${inCount} folder${inCount > 1 ? 's' : ''}` : 'Add to folder';
  const close = () => {
    setOpen(false);
    setCreating(false);
    button.current?.focus();
  };
  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) close();
      }}
    >
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}, ${channel.name}`}
        onClick={() => (open ? close() : setOpen(true))}
        className="text-text-muted hover:text-text flex h-9 items-center gap-1.5 self-start rounded-[6px] px-1.5 text-[13px] font-semibold"
      >
        <FolderIcon size={16} />
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`Folders for ${channel.name}`}
          className="border-border bg-surface flex flex-col gap-1 rounded-[8px] border p-2.5"
        >
          {folders.map((f) => (
            <label key={f.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={f.channelIds.includes(channel.id)}
                onChange={() => void toggleInFolder(f.id, channel.id)}
                className="accent-accent size-4"
              />
              {f.name}
            </label>
          ))}
          {creating ? (
            <FolderNameField
              submitLabel="Add"
              onCancel={close}
              onSave={async (name) => {
                const id = await createFolder(name);
                if (!id) return name.trim() ? `You can have up to ${FOLDER_LIMIT} folders.` : 'Type a name.';
                if (!folders.find((f) => f.id === id)?.channelIds.includes(channel.id)) {
                  await toggleInFolder(id, channel.id);
                }
                close();
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="text-text flex min-h-9 items-center self-start text-sm font-semibold underline underline-offset-2"
            >
              + New folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
