/**
 * bloom-filter-spectral.test.ts - Frequency-estimate properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bloom-filter-spectral";
import type { VisualFrame } from "@/types";

interface Input {
    keys?: number[];
    removes?: number[];
    queries?: number[];
}

const M = 16;
const SEEDS = [1, 2, 3];
const positions = (key: number): number[] =>
    SEEDS.map((seed) => {
        const raw = key * (seed * 37 + 11) + seed * 7;
        return ((raw % M) + M) % M;
    });

/** Independent tally of true multiplicities after adds and removes. */
function trueCounts(keys: number[], removes: number[]): Map<number, number> {
    const counts = new Map<number, number>();
    for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const k of removes) counts.set(k, Math.max(0, (counts.get(k) ?? 0) - 1));
    return counts;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Spectral bloom filter", () => {
    it("never underestimates a true count and never has false negatives", () => {
        const input: Input = {
            keys: [5, 17, 9, 5, 17, 5],
            removes: [9],
            queries: [5, 17, 9, 42, 3],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const estimates = frames[frames.length - 1]?.meta["frequencies"] as number[];
        const counts = trueCounts(input.keys!, input.removes!);
        const queries = input.queries!;
        expect(estimates.length).toBe(queries.length);
        for (let i = 0; i < queries.length; i += 1) {
            const key = queries[i]!;
            const estimate = estimates[i]!;
            const count = counts.get(key) ?? 0;
            expect(estimate).toBeGreaterThanOrEqual(count);
            if (count > 0) expect(estimate).toBeGreaterThan(0);
        }
    });

    it("property: estimate is the minimum of the k bucket counters", () => {
        let seed = 7;
        const rnd = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 15; trial += 1) {
            const keys = Array.from({ length: 6 }, () => Math.floor(rnd() * 40));
            const queries = Array.from({ length: 6 }, () => Math.floor(rnd() * 40));
            const input: Input = { keys, removes: [], queries };
            const frames = [...mod.run(input)];
            const estimates = frames[frames.length - 1]?.meta["frequencies"] as number[];
            const counters = new Array<number>(M).fill(0);
            for (const k of keys) for (const j of positions(k)) counters[j] = (counters[j] ?? 0) + 1;
            for (let i = 0; i < queries.length; i += 1) {
                const expected = Math.min(...positions(queries[i]!).map((j) => counters[j] ?? 0));
                expect(estimates[i]).toBe(expected);
            }
        }
    });

    it("reports a definitely absent key when all its buckets are zero", () => {
        const keys = [1, 2];
        const touched = new Set(keys.flatMap(positions));
        let absent = 0;
        for (let q = 0; q < 500; q += 1) {
            if (positions(q).every((j) => !touched.has(j))) {
                absent = q;
                break;
            }
        }
        const frames = [...mod.run({ keys, removes: [], queries: [absent] })];
        const estimate = (frames[frames.length - 1]?.meta["frequencies"] as number[])[0];
        expect(estimate).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
