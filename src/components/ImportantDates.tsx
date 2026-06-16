import { createSignal, For, Show } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { listDates, putDate, deleteDate, type ImportantDate } from "../lib/db";
import { credentials, dynamoCtx } from "../store/auth";

interface Props {
  friendId: string;
}

function formatDate(dateStr: string): string {
  const [, mm, dd] = dateStr.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${months[parseInt(mm) - 1]} ${parseInt(dd)}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  const [, mm, dd] = dateStr.split("-").map(Number);
  let next = new Date(today.getFullYear(), mm - 1, dd);
  if (next < today) next = new Date(today.getFullYear() + 1, mm - 1, dd);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ImportantDates(props: Props) {
  const qc = useQueryClient();
  const userId = () => credentials()?.userId ?? "";

  const [showAdd, setShowAdd] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [date, setDate] = createSignal("");
  const [recurring, setRecurring] = createSignal(false);

  const datesQuery = createQuery(() => ({
    queryKey: ["dates", userId(), props.friendId],
    queryFn: () => listDates(dynamoCtx()!, userId(), props.friendId),
    enabled: !!dynamoCtx() && !!userId() && !!props.friendId,
  }));

  const addMutation = createMutation(() => ({
    mutationFn: (data: { title: string; date: string; recurring: boolean }) =>
      putDate(dynamoCtx()!, userId(), props.friendId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dates", userId(), props.friendId] });
      setShowAdd(false);
      setTitle("");
      setDate("");
      setRecurring(false);
    },
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: (dateId: string) => deleteDate(dynamoCtx()!, userId(), props.friendId, dateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dates", userId(), props.friendId] }),
  }));

  function handleAdd() {
    if (!title().trim() || !date()) return;
    addMutation.mutate({ title: title().trim(), date: date(), recurring: recurring() });
  }

  const sorted = () =>
    [...(datesQuery.data ?? [])].sort((a: ImportantDate, b: ImportantDate) =>
      daysUntil(a.date) - daysUntil(b.date)
    );

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-300">Fechas importantes</h3>
        <button
          onClick={() => setShowAdd(!showAdd())}
          class="text-xs text-indigo-400 hover:text-indigo-300"
        >
          + Agregar fecha
        </button>
      </div>

      <Show when={showAdd()}>
        <div class="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Título (ej. Cumpleaños, Aniversario)"
            value={title()}
            onInput={(e) => setTitle(e.currentTarget.value)}
            class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="date"
            value={date()}
            onInput={(e) => setDate(e.currentTarget.value)}
            class="w-full rounded-lg bg-gray-900 border border-gray-600 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
          <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring()}
              onChange={(e) => setRecurring(e.currentTarget.checked)}
              class="rounded"
            />
            Se repite cada año
          </label>
          <div class="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !title().trim() || !date()}
              class="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => { setShowAdd(false); setTitle(""); setDate(""); setRecurring(false); }}
              class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm px-4"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Show>

      <Show when={datesQuery.isLoading}>
        <div class="text-sm text-gray-500">Cargando...</div>
      </Show>

      <Show when={!datesQuery.isLoading && sorted().length === 0}>
        <div class="text-sm text-gray-600 italic">Sin fechas importantes</div>
      </Show>

      <div class="flex flex-col gap-2">
        <For each={sorted()}>
          {(d: ImportantDate) => {
            const days = daysUntil(d.date);
            return (
              <div class="group flex items-center gap-3 rounded-xl bg-gray-800 border border-gray-700 px-4 py-3">
                <div class="flex-shrink-0 text-center w-12">
                  <div class="text-xs font-bold text-indigo-400">{days === 0 ? "HOY" : `${days}d`}</div>
                  <div class="text-xs text-gray-500">{formatDate(d.date)}</div>
                </div>
                <div class="flex-1">
                  <div class="text-sm font-medium text-white">{d.title}</div>
                  <Show when={d.recurring}>
                    <span class="text-xs text-gray-500">🔄 Anual</span>
                  </Show>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(d.dateId)}
                  class="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-opacity"
                >
                  ✕
                </button>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
