import { createSignal, Show, Switch, Match } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { listFriends, updateFriend, type Friend } from "../lib/db";
import { credentials, dynamoCtx } from "../store/auth";
import CategorySection from "./CategorySection";
import ImportantDates from "./ImportantDates";
import Notes from "./Notes";
import Reminders from "./Reminders";

interface Props {
  friendId: string;
}

type Tab = "preferences" | "dates" | "notes" | "reminders";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "preferences", label: "Preferencias", icon: "⭐" },
  { id: "dates", label: "Fechas", icon: "📅" },
  { id: "notes", label: "Notas", icon: "📝" },
  { id: "reminders", label: "Recordatorios", icon: "🔔" },
];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function FriendDetail(props: Props) {
  const qc = useQueryClient();
  const userId = () => credentials()?.userId ?? "";
  const [activeTab, setActiveTab] = createSignal<Tab>("preferences");
  const [editingName, setEditingName] = createSignal(false);
  const [nameInput, setNameInput] = createSignal("");

  const friendsQuery = createQuery(() => ({
    queryKey: ["friends", userId()],
    queryFn: () => listFriends(dynamoCtx()!, userId()),
    enabled: !!dynamoCtx() && !!userId(),
  }));

  const friend = (): Friend | undefined =>
    (friendsQuery.data ?? []).find((f: Friend) => f.friendId === props.friendId);

  const updateMutation = createMutation(() => ({
    mutationFn: (name: string) =>
      updateFriend(dynamoCtx()!, userId(), props.friendId, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends", userId()] });
      setEditingName(false);
    },
  }));

  function startEditName() {
    setNameInput(friend()?.name ?? "");
    setEditingName(true);
  }

  function saveName() {
    const n = nameInput().trim();
    if (!n) return;
    updateMutation.mutate(n);
  }

  return (
    <div class="flex flex-col h-full">
      <Show when={friendsQuery.isLoading}>
        <div class="flex items-center justify-center h-full text-gray-500">Cargando...</div>
      </Show>

      <Show when={!friendsQuery.isLoading && !friend()}>
        <div class="flex items-center justify-center h-full text-gray-600">Amigo no encontrado</div>
      </Show>

      <Show when={friend()}>
        {/* Header */}
        <div class="flex items-center gap-4 px-6 py-5 border-b border-gray-800">
          <div
            class="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg"
            style={{ "background-color": friend()!.avatarColor }}
          >
            {getInitials(friend()!.name)}
          </div>
          <div class="flex-1">
            <Show when={!editingName()}>
              <div class="flex items-center gap-2">
                <h2 class="text-xl font-bold text-white">{friend()!.name}</h2>
                <button
                  onClick={startEditName}
                  class="text-gray-500 hover:text-gray-300 text-xs"
                >
                  ✏
                </button>
              </div>
              <Show when={friend()!.nickname}>
                <div class="text-sm text-gray-400">"{friend()!.nickname}"</div>
              </Show>
              <Show when={friend()!.birthday}>
                <div class="text-xs text-gray-500 mt-0.5">🎂 {friend()!.birthday}</div>
              </Show>
            </Show>
            <Show when={editingName()}>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  value={nameInput()}
                  onInput={(e) => setNameInput(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  autofocus
                  class="rounded-lg bg-gray-800 border border-gray-600 px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={saveName}
                  disabled={updateMutation.isPending}
                  class="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1.5"
                >
                  ✕
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-gray-800 px-6">
          {TABS.map((tab) => (
            <button
              onClick={() => setActiveTab(tab.id)}
              class={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab() === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-y-auto p-6">
          <Switch>
            <Match when={activeTab() === "preferences"}>
              <CategorySection friendId={props.friendId} />
            </Match>
            <Match when={activeTab() === "dates"}>
              <ImportantDates friendId={props.friendId} />
            </Match>
            <Match when={activeTab() === "notes"}>
              <Notes friendId={props.friendId} />
            </Match>
            <Match when={activeTab() === "reminders"}>
              <Reminders friendId={props.friendId} />
            </Match>
          </Switch>
        </div>
      </Show>
    </div>
  );
}
