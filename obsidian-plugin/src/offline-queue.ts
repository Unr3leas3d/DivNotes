import type { SupabaseClient } from "@supabase/supabase-js";
import type CanopyPlugin from "./main";
import type { PluginPersistedData, QueueEntry } from "./types";

const MAX_RETRIES = 10;
const QUEUE_DATA_KEY = "_offlineQueue";
const FAILURE_COUNT_KEY = "_offlineFailures";

export class OfflineQueue {
  private plugin: CanopyPlugin;
  private supabase: SupabaseClient;
  private userId: string;
  private queue: QueueEntry[] = [];
  private draining = false;
  private failedCount = 0;

  constructor(plugin: CanopyPlugin, supabase: SupabaseClient, userId: string) {
    this.plugin = plugin;
    this.supabase = supabase;
    this.userId = userId;
  }

  async load(): Promise<void> {
    const data = ((await this.plugin.loadData()) ?? {}) as PluginPersistedData;
    this.queue = data[QUEUE_DATA_KEY] ?? [];
    this.failedCount = data[FAILURE_COUNT_KEY] ?? 0;
  }

  async enqueue(entry: Omit<QueueEntry, "retries">): Promise<void> {
    this.queue = this.queue.filter((item) => item.canopyId !== entry.canopyId);
    this.queue.push({ ...entry, retries: 0 });
    await this.persist();
  }

  async drain(): Promise<void> {
    if (this.draining || this.queue.length === 0) {
      return;
    }

    this.draining = true;
    const remaining: QueueEntry[] = [];

    try {
      for (const entry of this.queue) {
        const { error } = await this.supabase
          .from("notes")
          .update({
            content: entry.content,
            updated_at: entry.updatedAt
          })
          .eq("id", entry.canopyId)
          .eq("user_id", this.userId);

        if (!error) {
          continue;
        }

        const retries = entry.retries + 1;
        if (retries >= MAX_RETRIES) {
          this.failedCount += 1;
          continue;
        }

        remaining.push({
          ...entry,
          retries
        });
      }

      this.queue = remaining;
      await this.persist();
    } finally {
      this.draining = false;
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }

  getFailedCount(): number {
    return this.failedCount;
  }

  private async persist(): Promise<void> {
    const data = ((await this.plugin.loadData()) ?? {}) as PluginPersistedData;
    data[QUEUE_DATA_KEY] = this.queue;
    data[FAILURE_COUNT_KEY] = this.failedCount;
    await this.plugin.saveData(data);
  }
}
