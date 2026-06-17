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
  onBack?: () => void;
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
        <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-800" style={{ "padding-top": "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
          <Show when={props.onBack}>
            <button
              onClick={props.onBack}
              class="md:hidden text-gray-400 hover:text-white p-1 -ml-1 rounded text-lg leading-none"
            >
              ←
            </button>
          </Show>
          <div
            class="flex-shrink-0 w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white text-base md:text-lg font-bold shadow-lg"
            style={{ "background-color": friend()!.avatarColor }}
          >
            {getInitials(friend()!.name)}
          </div>
          <div class="flex-1 min-w-0">
            <Show when={!editingName()}>
              <div class="flex items-center gap-2">
                <h2 class="text-base md:text-xl font-bold text-white truncate">{friend()!.name}</h2>
                <button onClick={startEditName} class="text-gray-500 hover:text-gray-300 text-xs flex-shrink-0">
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
              <div class="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={nameInput()}
                  onInput={(e) => setNameInput(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  autofocus
                  class="rounded-lg bg-gray-800 border border-gray-600 px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500 min-w-0 flex-1"
                />
                <button
                  onClick={saveName}
                  disabled={updateMutation.isPending}
                  class="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 flex-shrink-0"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1.5 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </Show>
          </div>
        </div>

        {/* Tabs */}
        <div class="flex border-b border-gray-800 px-2 md:px-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              onClick={() => setActiveTab(tab.id)}
              class={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab() === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <span>{tab.icon}</span>
              <span class="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-y-auto p-4 md:p-6" style={{ "padding-bottom": "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
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
