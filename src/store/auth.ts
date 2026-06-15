import { createSignal } from "solid-js";
import { load } from "@tauri-apps/plugin-store";
import type { AwsCredentials } from "../lib/auth";
import { createDynamoTable } from "../lib/table";
import type { DynamoContext } from "../lib/table";

const STORE_KEY = "aws_credentials";

const [credentials, setCredentials] = createSignal<AwsCredentials | null>(null);
const [dynamoCtx, setDynamoCtx] = createSignal<DynamoContext | null>(null);
const [authLoading, setAuthLoading] = createSignal(true);

async function getStore() {
  return load("credentials.json", { autoSave: true });
}

export async function initAuth(): Promise<void> {
  try {
    const store = await getStore();
    const stored = await store.get<AwsCredentials>(STORE_KEY);
    if (stored && stored.expiration > Date.now()) {
      setCredentials(stored);
      setDynamoCtx(createDynamoTable(stored));
    }
  } catch {
    // no stored credentials
  } finally {
    setAuthLoading(false);
  }
}

export async function saveCredentials(creds: AwsCredentials): Promise<void> {
  const store = await getStore();
  await store.set(STORE_KEY, creds);
  setCredentials(creds);
  setDynamoCtx(createDynamoTable(creds));
}

export async function logout(): Promise<void> {
  const store = await getStore();
  await store.delete(STORE_KEY);
  setCredentials(null);
  setDynamoCtx(null);
}

export { credentials, dynamoCtx, authLoading };
