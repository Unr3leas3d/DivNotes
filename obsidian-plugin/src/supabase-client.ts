import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type CanopyPlugin from "./main";
import type { PluginPersistedData } from "./types";

const SUPABASE_URL = "https://zqdaairthppjdioddatv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxZGFhaXJ0aHBwamRpb2RkYXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Nzg3NDYsImV4cCI6MjA4NzU1NDc0Nn0.xdXncyCwiiAh4I666oRauqh0q_t3tTTPV0GHWVQSJW4";

function createObsidianStorageAdapter(plugin: CanopyPlugin) {
  return {
    getItem: async (key: string): Promise<string | null> => {
      const data = (await plugin.loadData()) as PluginPersistedData | null;
      return data?._supabase?.[key] ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      const data = ((await plugin.loadData()) ?? {}) as PluginPersistedData;
      if (!data._supabase) {
        data._supabase = {};
      }
      data._supabase[key] = value;
      await plugin.saveData(data);
    },
    removeItem: async (key: string): Promise<void> => {
      const data = ((await plugin.loadData()) ?? {}) as PluginPersistedData;
      if (!data._supabase) {
        return;
      }
      delete data._supabase[key];
      await plugin.saveData(data);
    }
  };
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(plugin: CanopyPlugin): SupabaseClient {
  if (client) {
    return client;
  }

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: createObsidianStorageAdapter(plugin),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce"
    }
  });

  return client;
}

export function resetSupabaseClient() {
  client = null;
}
