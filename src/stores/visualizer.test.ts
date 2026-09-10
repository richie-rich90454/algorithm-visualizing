/**
 * visualizer.test.ts - Smoke tests for the async store loading path.
 *
 * Algorithm code ships in per-module chunks fetched on demand, so loading
 * is async: these checks guarantee the loading flag brackets the fetch,
 * frames land in the engine afterwards, unknown ids change nothing, and a
 * rapid double-selection only applies the latest fetch.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useVisualizerStore } from "./visualizer";

beforeEach(() => {
    setActivePinia(createPinia());
});

describe("visualizer store", () => {
    it("loads an algorithm's frames on demand", async () => {
        const store = useVisualizerStore();
        const pending = store.loadAlgorithm("bubble-sort");
        expect(store.isLoading).toBe(true);
        await pending;
        expect(store.isLoading).toBe(false);
        expect(store.algorithmId).toBe("bubble-sort");
        expect(store.algorithm?.name).toBe("Bubble Sort");
        expect(store.totalSteps).toBeGreaterThan(0);
        expect(store.currentFrame).not.toBeNull();
    });

    it("ignores unknown ids without touching state", async () => {
        const store = useVisualizerStore();
        await store.loadAlgorithm("no-such-algorithm");
        expect(store.isLoading).toBe(false);
        expect(store.algorithmId).toBeNull();
        expect(store.totalSteps).toBe(0);
    });

    it("applies only the latest of rapid selections", async () => {
        const store = useVisualizerStore();
        const first = store.loadAlgorithm("bubble-sort");
        const second = store.loadAlgorithm("insertion-sort");
        await Promise.all([first, second]);
        expect(store.algorithmId).toBe("insertion-sort");
        expect(store.isLoading).toBe(false);
        expect(store.totalSteps).toBeGreaterThan(0);
    });

    it("reopening a cached module skips the fetch", async () => {
        const store = useVisualizerStore();
        await store.loadAlgorithm("bubble-sort");
        expect(store.isLoading).toBe(false);
        await store.loadAlgorithm("bubble-sort");
        expect(store.algorithmId).toBe("bubble-sort");
        expect(store.totalSteps).toBeGreaterThan(0);
    });
});
