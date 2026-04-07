import { describe, expect, it, vi } from "vitest";
import { OfflineQueue } from "./offline-queue";
import type { PluginPersistedData } from "./types";

function createPlugin(initialData: PluginPersistedData = {}) {
  let data = structuredClone(initialData);

  return {
    plugin: {
      async loadData() {
        return structuredClone(data);
      },
      async saveData(next: PluginPersistedData) {
        data = structuredClone(next);
      }
    },
    read: () => structuredClone(data)
  };
}

describe("OfflineQueue", () => {
  it("replaces queued entries for the same note and persists them", async () => {
    const pluginState = createPlugin();
    const supabase = { from: vi.fn() };
    const queue = new OfflineQueue(pluginState.plugin as never, supabase as never, "user-1");

    await queue.load();
    await queue.enqueue({
      canopyId: "note-1",
      content: "first",
      updatedAt: "2026-04-06T00:00:00Z"
    });
    await queue.enqueue({
      canopyId: "note-1",
      content: "second",
      updatedAt: "2026-04-06T01:00:00Z"
    });

    expect(queue.getPendingCount()).toBe(1);
    expect(pluginState.read()._offlineQueue).toEqual([
      {
        canopyId: "note-1",
        content: "second",
        updatedAt: "2026-04-06T01:00:00Z",
        retries: 0
      }
    ]);
  });

  it("retries failed items and tracks items that exceeded the retry budget", async () => {
    const pluginState = createPlugin({
      _offlineQueue: [
        {
          canopyId: "note-1",
          content: "body",
          updatedAt: "2026-04-06T00:00:00Z",
          retries: 9
        }
      ]
    });

    const update = vi.fn().mockResolvedValue({ error: new Error("offline") });
    const eq = vi.fn().mockReturnThis();
    const supabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq })
      })
    };
    eq.mockReturnValue({ eq });
    eq.mockReturnValueOnce({ eq });
    eq.mockReturnValueOnce(Promise.resolve({ error: new Error("offline") }));

    const queue = new OfflineQueue(pluginState.plugin as never, supabase as never, "user-1");
    await queue.load();
    await queue.drain();

    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(1);
    expect(pluginState.read()._offlineFailures).toBe(1);
  });
});
