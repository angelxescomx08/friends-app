import { createSignal, For, Show } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { listNotes, putNote, updateNote, deleteNote, type Note } from "../lib/db";
import { credentials, dynamoCtx } from "../store/auth";

interface Props {
  friendId: string;
}

export default function Notes(props: Props) {
  const qc = useQueryClient();
  const userId = () => credentials()?.userId ?? "";

  const [showAdd, setShowAdd] = createSignal(false);
  const [newContent, setNewContent] = createSignal("");
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [editContent, setEditContent] = createSignal("");

  const notesQuery = createQuery(() => ({
    queryKey: ["notes", userId(), props.friendId],
    queryFn: () => listNotes(dynamoCtx()!, userId(), props.friendId),
    enabled: !!dynamoCtx() && !!userId() && !!props.friendId,
  }));

  const addMutation = createMutation(() => ({
    mutationFn: (content: string) =>
      putNote(dynamoCtx()!, userId(), props.friendId, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", userId(), props.friendId] });
      setShowAdd(false);
      setNewContent("");
    },
  }));

  const editMutation = createMutation(() => ({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      updateNote(dynamoCtx()!, userId(), props.friendId, noteId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes", userId(), props.friendId] });
      setEditingId(null);
      setEditContent("");
    },
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: (noteId: string) =>
      deleteNote(dynamoCtx()!, userId(), props.friendId, noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes", userId(), props.friendId] }),
  }));

  const sorted = () =>
    [...(notesQuery.data ?? [])].sort(
      (a: Note, b: Note) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  function startEdit(note: Note) {
    setEditingId(note.noteId);
    setEditContent(note.content);
  }

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-300">Notas</h3>
        <button
          onClick={() => setShowAdd(!showAdd())}
          class="text-xs text-indigo-400 hover:text-indigo-300"
        >
          + Agregar nota
        </button>
      </div>

      <Show when={showAdd()}>
        <div class="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-3">
          <textarea
            placeholder="Escribe una nota sobre tu amigo..."
            value={newContent()}
            onInput={(e) => setNewContent(e.currentTarget.value)}
            rows={3}
            class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
          <div class="flex gap-2">
            <button
              onClick={() => addMutation.mutate(newContent().trim())}
              disabled={addMutation.isPending || !newContent().trim()}
              class="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewContent(""); }}
              class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm px-4"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Show>

      <Show when={notesQuery.isLoading}>
        <div class="text-sm text-gray-500">Cargando...</div>
      </Show>

      <Show when={!notesQuery.isLoading && sorted().length === 0}>
        <div class="text-sm text-gray-600 italic">Aún no hay notas</div>
      </Show>

      <div class="flex flex-col gap-2">
        <For each={sorted()}>
          {(note: Note) => (
            <div class="group rounded-xl bg-gray-800 border border-gray-700 p-4">
              <Show when={editingId() !== note.noteId}>
                <p class="text-sm text-gray-200 whitespace-pre-wrap">{note.content}</p>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-xs text-gray-600">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                  <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(note)}
                      class="text-xs text-gray-400 hover:text-indigo-400"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(note.noteId)}
                      class="text-xs text-gray-400 hover:text-red-400"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </Show>
              <Show when={editingId() === note.noteId}>
                <textarea
                  value={editContent()}
                  onInput={(e) => setEditContent(e.currentTarget.value)}
                  rows={3}
                  class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
                <div class="mt-2 flex gap-2">
                  <button
                    onClick={() => editMutation.mutate({ noteId: note.noteId, content: editContent().trim() })}
                    disabled={editMutation.isPending || !editContent().trim()}
                    class="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditContent(""); }}
                    class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5"
                  >
                    Cancelar
                  </button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
