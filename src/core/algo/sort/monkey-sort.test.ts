/**
 * monkey-sort.test.ts - Correctness, determinism, frame contract, termination.
 */

import { describe, expect, it } from "vitest";
import monkeySort from "./monkey-sort";
import type { VisualFrame } from "@/types";

function collect(input: unknown): VisualFrame[] {
    return [...monkeySort.run(input)];
}

function valuesOf(frame: VisualFrame): number[] {
    return frame.entities
        .filter((entity) => entity.type === "bar")
        .map((entity) => Number(entity.value))
        .filter((value) => Number.isFinite(value));
}

function sortedCopy(values: number[]): number[] {
    return [...values].sort((a, b) => a - b);
}

describe("MonkeySort", () => {
    it("yields well-formed frames and terminates cleanly", () => {
        const generator = monkeySort.run(monkeySort.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            frames.push(frame);
        }
        expect(frames.length).toBeGreaterThan(2);
        expect(frames.map((f) => f.stepNumber)).toEqual(frames.map((_, i) => i));
        expect(generator.next().done).toBe(true);
    });

    it("every frame is a permutation of the original multiset", () => {
        for (const input of [[3, 1, 4, 2], [5, 5, 1], [1], []]) {
            const expected = sortedCopy(input);
            for (const frame of collect(input)) {
                expect(sortedCopy(valuesOf(frame))).toEqual(expected);
            }
        }
    });

    it("finishes sorted for inputs small enough to succeed (or reports an honest give-up)", () => {
        for (const input of [[3, 1, 4, 2], [2, 1], [1, 2], [5, 5, 1]]) {
            const frames = collect(input);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            const values = valuesOf(final!);
            const isSorted = values.every((v, i) => i === 0 || (values[i - 1] ?? v) <= v);
            const claimedSorted = final!.description.toLowerCase().includes("sorted by pure luck");
            // The final frame must never claim success unless the data is truly sorted.
            expect(claimedSorted).toBe(isSorted);
            // For these small inputs the seeded shuffle should succeed within the cap.
            expect(isSorted).toBe(true);
        }
    });

    it("is deterministic: the same input replays the exact same frames", () => {
        const input = [3, 1, 4, 2];
        const a = collect(input).map((frame) => JSON.stringify(frame.entities));
        const b = collect(input).map((frame) => JSON.stringify(frame.entities));
        expect(a).toEqual(b);
    });
});
