import { createSignal, Show } from "solid-js";
import { credentials, logout } from "../store/auth";
import FriendsList from "./FriendsList";
import FriendDetail from "./FriendDetail";

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Layout() {
  const [selectedFriendId, setSelectedFriendId] = createSignal<string | null>(null);

  return (
    <div class="flex h-screen w-screen bg-gray-950 text-white overflow-hidden">
      {/* Sidebar */}
      <div class="flex flex-col w-72 flex-shrink-0 bg-gray-900 border-r border-gray-800">
        {/* User header */}
        <div class="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
          <Show when={credentials()?.picture}>
            <img
              src={credentials()!.picture}
              alt="avatar"
              class="w-8 h-8 rounded-full"
            />
          </Show>
          <Show when={!credentials()?.picture}>
            <div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
              {getInitials(credentials()?.name ?? "?")}
            </div>
          </Show>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-white truncate">{credentials()?.name}</div>
            <div class="text-xs text-gray-500 truncate">{credentials()?.email}</div>
          </div>
          <button
            onClick={logout}
            class="text-gray-500 hover:text-red-400 text-xs px-1.5 py-1 rounded hover:bg-gray-800 transition-colors"
            title="Sign out"
          >
            ↩
          </button>
        </div>

        {/* App name */}
        <div class="px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">👥</span>
            <span class="text-sm font-semibold text-gray-300">My Friends</span>
          </div>
        </div>

        {/* Friends list */}
        <div class="flex-1 overflow-hidden">
          <FriendsList
            selectedFriendId={selectedFriendId()}
            onSelect={(id) => setSelectedFriendId(id)}
          />
        </div>
      </div>

      {/* Main area */}
      <div class="flex-1 overflow-hidden">
        <Show when={selectedFriendId()}>
          <FriendDetail friendId={selectedFriendId()!} />
        </Show>
        <Show when={!selectedFriendId()}>
          <div class="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
            <span class="text-6xl">👈</span>
            <div class="text-center">
              <div class="text-lg font-medium">Selecciona un amigo</div>
              <div class="text-sm mt-1">o agrega uno nuevo para comenzar</div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
