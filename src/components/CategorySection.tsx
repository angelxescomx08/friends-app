import { createSignal, For, Show } from "solid-js";
import { createQuery, createMutation, useQueryClient } from "@tanstack/solid-query";
import { listPreferences, upsertPreference, type Preference } from "../lib/db";
import { CATEGORIES, type Category } from "../lib/table";
import { credentials, dynamoCtx } from "../store/auth";

interface Props {
  friendId: string;
}

const CATEGORY_META: Record<Category, { icon: string; label: string }> = {
  food: { icon: "🍕", label: "Food" },
  drink: { icon: "🥤", label: "Drinks" },
  music: { icon: "🎵", label: "Music" },
  movies: { icon: "🎬", label: "Movies" },
  series: { icon: "📺", label: "Series" },
  books: { icon: "📚", label: "Books" },
  games: { icon: "🎮", label: "Games" },
  places: { icon: "📍", label: "Places" },
  colors: { icon: "🎨", label: "Colors" },
  gifts: { icon: "🎁", label: "Gift Ideas" },
  hobbies: { icon: "⚡", label: "Hobbies" },
  dislikes: { icon: "👎", label: "Dislikes" },
};

interface CategoryCardProps {
  category: Category;
  items: string[];
  onAdd: (category: Category, value: string) => void;
  onRemove: (category: Category, value: string) => void;
  saving: boolean;
}

function CategoryCard(props: CategoryCardProps) {
  const [adding, setAdding] = createSignal(false);
  const [input, setInput] = createSignal("");
  const meta = CATEGORY_META[props.category];

  function handleAdd() {
    const v = input().trim();
    if (!v) return;
    props.onAdd(props.category, v);
    setInput("");
    setAdding(false);
  }

  return (
    <div class="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">{meta.icon}</span>
          <span class="text-sm font-semibold text-gray-200">{meta.label}</span>
        </div>
        <button
          onClick={() => setAdding(true)}
          class="text-gray-500 hover:text-indigo-400 text-lg leading-none"
          title="Add item"
        >
          +
        </button>
      </div>

      <div class="flex flex-wrap gap-1.5 min-h-6">
        <For each={props.items}>
          {(item) => (
            <span class="group inline-flex items-center gap-1 rounded-full bg-gray-700 px-2.5 py-0.5 text-xs text-gray-200">
              {item}
              <button
                onClick={() => props.onRemove(props.category, item)}
                class="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity leading-none"
              >
                ×
              </button>
            </span>
          )}
        </For>
        <Show when={props.items.length === 0 && !adding()}>
          <span class="text-xs text-gray-600 italic">None added</span>
        </Show>
      </div>

      <Show when={adding()}>
        <div class="flex gap-2">
          <input
            type="text"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setAdding(false); setInput(""); } }}
            autofocus
            placeholder={`Add ${meta.label.toLowerCase()}...`}
            class="flex-1 rounded-lg bg-gray-900 border border-gray-600 px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleAdd}
            disabled={props.saving}
            class="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setAdding(false); setInput(""); }}
            class="rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs px-2"
          >
            ✕
          </button>
        </div>
      </Show>
    </div>
  );
}

export default function CategorySection(props: Props) {
  const qc = useQueryClient();
  const userId = () => credentials()?.userId ?? "";

  const prefsQuery = createQuery(() => ({
    queryKey: ["preferences", userId(), props.friendId],
    queryFn: () => listPreferences(dynamoCtx()!, userId(), props.friendId),
    enabled: !!dynamoCtx() && !!userId() && !!props.friendId,
  }));

  const saveMutation = createMutation(() => ({
    mutationFn: ({ category, items }: { category: Category; items: string[] }) =>
      upsertPreference(dynamoCtx()!, userId(), props.friendId, category, items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["preferences", userId(), props.friendId] }),
  }));

  function getItems(category: Category): string[] {
    const pref = (prefsQuery.data ?? []).find((p: Preference) => p.category === category);
    return pref?.items ?? [];
  }

  function handleAdd(category: Category, value: string) {
    const current = getItems(category);
    if (current.includes(value)) return;
    saveMutation.mutate({ category, items: [...current, value] });
  }

  function handleRemove(category: Category, value: string) {
    const current = getItems(category);
    saveMutation.mutate({ category, items: current.filter((i) => i !== value) });
  }

  return (
    <div>
      <Show when={prefsQuery.isLoading}>
        <div class="text-sm text-gray-500 py-4">Loading preferences...</div>
      </Show>
      <div class="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <For each={CATEGORIES}>
          {(cat) => (
            <CategoryCard
              category={cat}
              items={getItems(cat)}
              onAdd={handleAdd}
              onRemove={handleRemove}
              saving={saveMutation.isPending}
            />
          )}
        </For>
      </div>
    </div>
  );
}
