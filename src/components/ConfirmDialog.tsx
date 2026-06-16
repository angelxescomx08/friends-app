import { Show } from "solid-js";
import { Portal } from "solid-js/web";

interface Props {
  open: boolean;
  message: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog(props: Props) {
  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) props.onCancel();
  }

  return (
    <Show when={props.open}>
      <Portal>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={handleBackdrop}
        >
          <div class="w-80 rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6 flex flex-col gap-5">
            <div class="flex flex-col gap-1">
              <h2 class="text-base font-semibold text-white">¿Eliminar?</h2>
              <p class="text-sm text-gray-400">{props.message}</p>
            </div>
            <div class="flex gap-3">
              <button
                onClick={props.onCancel}
                class="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-sm py-2.5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={props.onConfirm}
                disabled={props.isPending}
                class="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm py-2.5 transition-colors disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
