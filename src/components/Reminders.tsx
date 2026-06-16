import { createSignal, For, Show } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { listReminders, putReminder, toggleReminder, deleteReminder, type Reminder } from "../lib/db";
import { credentials, dynamoCtx } from "../store/auth";

interface Props {
  friendId: string;
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isPast(isoStr: string): boolean {
  return new Date(isoStr) < new Date();
}

export default function Reminders(props: Props) {
  const qc = useQueryClient();
  const userId = () => credentials()?.userId ?? "";

  const [showAdd, setShowAdd] = createSignal(false);
  const [rTitle, setRTitle] = createSignal("");
  const [rDesc, setRDesc] = createSignal("");
  const [rDate, setRDate] = createSignal("");

  const remindersQuery = createQuery(() => ({
    queryKey: ["reminders", userId(), props.friendId],
    queryFn: () => listReminders(dynamoCtx()!, userId(), props.friendId),
    enabled: !!dynamoCtx() && !!userId() && !!props.friendId,
  }));

  const addMutation = createMutation(() => ({
    mutationFn: (data: { title: string; description?: string; remindAt: string }) =>
      putReminder(dynamoCtx()!, userId(), props.friendId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", userId(), props.friendId] });
      setShowAdd(false);
      setRTitle("");
      setRDesc("");
      setRDate("");
    },
  }));

  const toggleMutation = createMutation(() => ({
    mutationFn: ({ reminderId, completed }: { reminderId: string; completed: boolean }) =>
      toggleReminder(dynamoCtx()!, userId(), props.friendId, reminderId, completed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders", userId(), props.friendId] }),
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: (reminderId: string) =>
      deleteReminder(dynamoCtx()!, userId(), props.friendId, reminderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders", userId(), props.friendId] }),
  }));

  function handleAdd() {
    if (!rTitle().trim() || !rDate()) return;
    addMutation.mutate({ title: rTitle().trim(), description: rDesc().trim() || undefined, remindAt: new Date(rDate()).toISOString() });
  }

  const sorted = () =>
    [...(remindersQuery.data ?? [])].sort(
      (a: Reminder, b: Reminder) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime()
    );

  const pending = () => sorted().filter((r: Reminder) => !r.completed);
  const done = () => sorted().filter((r: Reminder) => r.completed);

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-300">Recordatorios</h3>
        <button
          onClick={() => setShowAdd(!showAdd())}
          class="text-xs text-indigo-400 hover:text-indigo-300"
        >
          + Agregar recordatorio
        </button>
      </div>

      <Show when={showAdd()}>
        <div class="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Título del recordatorio"
            value={rTitle()}
            onInput={(e) => setRTitle(e.currentTarget.value)}
            class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Descripción (opcional)"
            value={rDesc()}
            onInput={(e) => setRDesc(e.currentTarget.value)}
            class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="datetime-local"
            value={rDate()}
            onInput={(e) => setRDate(e.currentTarget.value)}
            class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <div class="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !rTitle().trim() || !rDate()}
              class="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => { setShowAdd(false); setRTitle(""); setRDesc(""); setRDate(""); }}
              class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm px-4"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Show>

      <Show when={remindersQuery.isLoading}>
        <div class="text-sm text-gray-500">Cargando...</div>
      </Show>

      <Show when={!remindersQuery.isLoading && sorted().length === 0}>
        <div class="text-sm text-gray-600 italic">Aún no hay recordatorios</div>
      </Show>

      <div class="flex flex-col gap-2">
        <For each={pending()}>
          {(r: Reminder) => (
            <div
              class={`group flex items-start gap-3 rounded-xl border px-4 py-3 ${
                isPast(r.remindAt)
                  ? "bg-red-950/30 border-red-900"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={r.completed}
                onChange={() => toggleMutation.mutate({ reminderId: r.reminderId, completed: !r.completed })}
                class="mt-0.5 cursor-pointer accent-indigo-500"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white">{r.title}</div>
                <Show when={r.description}>
                  <div class="text-xs text-gray-400">{r.description}</div>
                </Show>
                <div class={`text-xs mt-0.5 ${isPast(r.remindAt) ? "text-red-400" : "text-gray-500"}`}>
                  {isPast(r.remindAt) ? "⚠ " : "🕐 "}{formatDateTime(r.remindAt)}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(r.reminderId)}
                class="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-opacity"
              >
                ✕
              </button>
            </div>
          )}
        </For>

        <Show when={done().length > 0}>
          <div class="text-xs text-gray-600 mt-2 mb-1">Completados</div>
          <For each={done()}>
            {(r: Reminder) => (
              <div class="group flex items-start gap-3 rounded-xl bg-gray-900 border border-gray-800 px-4 py-3 opacity-60">
                <input
                  type="checkbox"
                  checked={r.completed}
                  onChange={() => toggleMutation.mutate({ reminderId: r.reminderId, completed: false })}
                  class="mt-0.5 cursor-pointer accent-indigo-500"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-gray-400 line-through">{r.title}</div>
                  <div class="text-xs text-gray-600">{formatDateTime(r.remindAt)}</div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(r.reminderId)}
                  class="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-opacity"
                >
                  ✕
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
