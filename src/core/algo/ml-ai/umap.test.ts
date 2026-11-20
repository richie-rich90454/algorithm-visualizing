/**
 * umap.test.ts - Fuzzy union properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./umap";
import type { VisualFrame } from "@/types";

function referenceUnion(directed: number[][]): number[][] {
    const k = directed.length;
    return directed.map((_, i) =>
        directed.map((__, j) => {
            if (i === j) {
                return 0;
            }
            const a = directed[i]?.[j] ?? 0;
            const b = directed[j]?.[i] ?? 0;
            return a + b - a * b;
        }),
    );
}

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBe(k + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(k * k);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("UMAP", () => {
    it("matches an independent fuzzy union and satisfies its properties", () => {
        const directed = (mod.defaultInput as { directed: number[][] }).directed;
        const frames = [...mod.run({ directed })];
        checkFrames(frames, directed.length);
        const expected = referenceUnion(directed);
        const flat = (frames[frames.length - 1]?.meta["graph"] as string[]).map(Number);
        const k = directed.length;
        for (let i = 0; i < k; i += 1) {
            for (let j = 0; j < k; j += 1) {
                const value = flat[i * k + j] ?? 0;
                const want = expected[i]?.[j] ?? 0;
                expect(value).toBeCloseTo(want, 2);
                expect(value).toBeCloseTo(expected[j]?.[i] ?? 0, 2);
                expect(value).toBeGreaterThanOrEqual((directed[i]?.[j] ?? 0) - 1e-6);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
                if (i === j) {
                    expect(value).toBe(0);
                }
            }
        }
    });

    it("handles a two-point graph", () => {
        const frames = [...mod.run({ directed: [
            [0, 0.4],
            [0.7, 0],
        ] })];
        checkFrames(frames, 2);
        const flat = (frames[frames.length - 1]?.meta["graph"] as string[]).map(Number);
        const merged = 0.4 + 0.7 - 0.4 * 0.7;
        expect(flat[1]).toBeCloseTo(merged, 2);
        expect(flat[2]).toBeCloseTo(merged, 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
