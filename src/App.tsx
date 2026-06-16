import { createEffect, Show } from "solid-js";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { credentials, authLoading, initAuth } from "./store/auth";
import Login from "./components/Login";
import Layout from "./components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  createEffect(() => {
    initAuth();
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Show when={!authLoading()} fallback={
        <div class="flex h-screen w-screen items-center justify-center bg-gray-950">
          <div class="text-gray-500 text-sm">Cargando...</div>
        </div>
      }>
        <Show when={credentials()} fallback={<Login />}>
          <Layout />
        </Show>
      </Show>
    </QueryClientProvider>
  );
}
