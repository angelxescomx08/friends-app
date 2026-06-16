import { createSignal, For, Show } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { listFriends, putFriend, deleteFriend, type Friend } from "../lib/db";
import { credentials, dynamoCtx } from "../store/auth";
import ConfirmDialog from "./ConfirmDialog";

interface Props {
  selectedFriendId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
}

function getInitials(name: string): string {
  return (name ?? "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function isBirthdaySoon(birthday?: string): boolean {
  if (!birthday) return false;
  const today = new Date();
  const [, mm, dd] = birthday.split("-").map(Number);
  const thisYear = new Date(today.getFullYear(), mm - 1, dd);
  const diff = thisYear.getTime() - today.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 7;
}

function isBirthdayToday(birthday?: string): boolean {
  if (!birthday) return false;
  const today = new Date();
  const [, mm, dd] = birthday.split("-").map(Number);
  return today.getMonth() + 1 === mm && today.getDate() === dd;
}

export default function FriendsList(props: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = createSignal("");
  const [showAdd, setShowAdd] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [addError, setAddError] = createSignal("");
  const [confirmDeleteId, setConfirmDeleteId] = createSignal<string | null>(null);
  const [deleteError, setDeleteError] = createSignal("");

  const userId = () => credentials()?.userId ?? "";

  const friendsQuery = createQuery(() => ({
    queryKey: ["friends", userId()],
    queryFn: () => listFriends(dynamoCtx()!, userId()),
    enabled: !!dynamoCtx() && !!userId(),
  }));

  const addMutation = createMutation(() => ({
    mutationFn: (name: string) =>
      putFriend(dynamoCtx()!, userId(), { name, avatarColor: randomColor() }),
    onSuccess: (friend) => {
      qc.invalidateQueries({ queryKey: ["friends", userId()] });
      setShowAdd(false);
      setNewName("");
      props.onSelect(friend.friendId);
    },
  }));

  const deleteMutation = createMutation(() => ({
    mutationFn: (friendId: string) => deleteFriend(dynamoCtx()!, userId(), friendId),
    onSuccess: (_, friendId) => {
      setDeleteError("");
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ["friends", userId()] });
      if (props.selectedFriendId === friendId) {
        props.onDeselect();
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error al eliminar";
      setDeleteError(msg);
    },
  }));

  const filtered = () => {
    const q = search().toLowerCase();
    return (friendsQuery.data ?? []).filter((f) =>
      (f.name ?? "").toLowerCase().includes(q) || (f.nickname ?? "").toLowerCase().includes(q)
    );
  };

  function handleAdd() {
    const name = newName().trim();
    if (!name) { setAddError("El nombre es obligatorio"); return; }
    setAddError("");
    addMutation.mutate(name);
  }

  return (
    <div class="flex flex-col h-full">
      <div class="p-4 border-b border-gray-800">
        <input
          type="text"
          placeholder="Buscar amigos..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={friendsQuery.isLoading}>
          <div class="flex items-center justify-center h-32 text-gray-500 text-sm">Cargando...</div>
        </Show>
        <Show when={friendsQuery.isError}>
          <div class="p-4 text-red-400 text-sm">Error al cargar amigos</div>
        </Show>
        <Show when={!friendsQuery.isLoading && filtered().length === 0 && !showAdd()}>
          <div class="flex flex-col items-center justify-center h-48 text-gray-600 text-sm gap-2">
            <span class="text-3xl">👤</span>
            <span>Aún no hay amigos</span>
          </div>
        </Show>
        <For each={filtered()}>
          {(friend: Friend) => (
            <div
              onClick={() => props.onSelect(friend.friendId)}
              class={`group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors ${
                props.selectedFriendId === friend.friendId ? "bg-gray-800 border-l-2 border-indigo-500" : ""
              }`}
            >
              <div
                class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ "background-color": friend.avatarColor }}
              >
                {getInitials(friend.name)}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-sm font-medium text-white truncate">{friend.name}</span>
                  <Show when={isBirthdayToday(friend.birthday)}>
                    <span class="text-sm">🎂</span>
                  </Show>
                  <Show when={!isBirthdayToday(friend.birthday) && isBirthdaySoon(friend.birthday)}>
                    <span class="text-xs text-yellow-400">pronto</span>
                  </Show>
                </div>
                <Show when={friend.nickname}>
                  <div class="text-xs text-gray-500 truncate">{friend.nickname}</div>
                </Show>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(friend.friendId); }}
                class="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-500 hover:text-red-400 text-xs px-1 transition-opacity"
              >
                ✕
              </button>
            </div>
          )}
        </For>
      </div>

      <div class="p-3 border-t border-gray-800">
        <Show when={showAdd()}>
          <div class="mb-2 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Nombre del amigo"
              value={newName()}
              onInput={(e) => setNewName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }}
              autofocus
              class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <Show when={addError()}>
              <span class="text-xs text-red-400">{addError()}</span>
            </Show>
            <div class="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                class="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-1.5 disabled:opacity-50"
              >
                Agregar
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewName(""); setAddError(""); }}
                class="flex-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Show>
        <Show when={!showAdd()}>
          <button
            onClick={() => setShowAdd(true)}
            class="w-full rounded-lg border border-dashed border-gray-700 hover:border-indigo-500 text-gray-500 hover:text-indigo-400 text-sm py-2 transition-colors"
          >
            + Agregar amigo
          </button>
        </Show>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteId()}
        message={deleteError() || "Esta acción no se puede deshacer."}
        isPending={deleteMutation.isPending}
        onConfirm={() => { setDeleteError(""); deleteMutation.mutate(confirmDeleteId()!); }}
        onCancel={() => { setDeleteError(""); setConfirmDeleteId(null); }}
      />
    </div>
  );
}
