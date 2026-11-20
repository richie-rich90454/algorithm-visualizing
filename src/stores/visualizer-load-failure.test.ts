/**
 * visualizer-load-failure.test.ts - Regression: a failed chunk fetch must not
 * leave a new algorithm id paired with the previous algorithm's frames.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const loadMock = vi.fn();
vi.mock("@/core", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/core")>();
    return { ...actual, loadAlgorithmModule: (id: string) => loadMock(id) };
});
vi.mock("@/core/manifest", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/core/manifest")>();
    return { ...actual };
});

import { useVisualizerStore } from "./visualizer";

beforeEach(() => {
    setActivePinia(createPinia());
    loadMock.mockReset();
});

describe("visualizer store load failures", () => {
    it("reverts the id and clears frames when a chunk fails to load", async () => {
        const store = useVisualizerStore();
        // First load succeeds via the real loader path for this id.
        const real = (await import("@/core")).getAllAlgorithms();
        expect(real.length).toBeGreaterThan(0);
        // Use the real loader directly to obtain a valid module for the mock.
        const { LOADERS } = await import("@/core/manifest");
        const bubble = LOADERS["bubble-sort"];
        loadMock.mockResolvedValueOnce((await bubble!()).default);
        await store.loadAlgorithm("bubble-sort");
        expect(store.algorithmId).toBe("bubble-sort");
        expect(store.totalSteps).toBeGreaterThan(0);

        // A subsequent load rejects: the store must revert and clear.
        loadMock.mockRejectedValueOnce(new Error("chunk offline"));
        await store.loadAlgorithm("insertion-sort");
        expect(store.algorithmId).toBe("bubble-sort");
        expect(store.loadedModule).toBeNull();
        expect(store.totalSteps).toBe(0);
        expect(store.currentFrame).toBeNull();
        expect(store.isLoading).toBe(false);
    });
});
