/**
 * multinomial-distribution.test.ts - Exhaustive sequence enumeration, sampling, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./multinomial-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(Number.isFinite(entity.value as number)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

/** Enumerate every length-n sequence over the categories and accumulate probability by count vector. */
function enumerate(n: number, probabilities: number[]): Map<string, number> {
    const totals = new Map<string, number>();
    const total = probabilities.length ** n;
    for (let code = 0; code < total; code += 1) {
        const counts = new Array<number>(probabilities.length).fill(0);
        let probability = 1;
        let remaining = code;
        for (let trial = 0; trial < n; trial += 1) {
            const category = remaining % probabilities.length;
            remaining = Math.floor(remaining / probabilities.length);
            counts[category] = (counts[category] as number) + 1;
            probability *= probabilities[category] as number;
        }
        const key = counts.join(",");
        totals.set(key, (totals.get(key) ?? 0) + probability);
    }
    return totals;
}

describe("MultinomialDistribution", () => {
    it("matches exhaustive enumeration of all trial sequences", () => {
        const n = 5;
        const probabilities = [0.5, 0.3, 0.2];
        const expected = enumerate(n, probabilities);
        expect(Math.abs(Array.from(expected.values()).reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-10);
        for (const counts of [[5, 0, 0], [2, 2, 1], [1, 3, 1], [0, 0, 5], [2, 1, 2]]) {
            const frames = [...mod.run({ n, probabilities, counts, samples: 10 })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["pmf"])).toBeCloseTo(expected.get(counts.join(",")) ?? 0, 10);
        }
    });

    it("reports zero probability for a count vector that does not sum to n", () => {
        const frames = [...mod.run({ n: 5, probabilities: [0.5, 0.3, 0.2], counts: [2, 2, 2], samples: 10 })];
        checkFrames(frames);
        expect(Number(frames[frames.length - 1]?.meta["pmf"])).toBe(0);
    });

    it("reproduces the probabilities by sampling and preserves all counts", () => {
        const probabilities = [0.5, 0.3, 0.2];
        const samples = 10000;
        const n = 8;
        const frames = [...mod.run({ n, probabilities, counts: [4, 3, 1], samples, seed: 2024 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const sampledCounts = meta?.["sampledCounts"] as number[];
        const empirical = meta?.["empirical"] as number[];
        const expected = meta?.["expected"] as number[];
        expect(sampledCounts.reduce((a, b) => a + b, 0)).toBe(samples * n);
        for (let i = 0; i < probabilities.length; i += 1) {
            expect(empirical[i]).toBeCloseTo(probabilities[i] as number, 2);
            expect(expected[i]).toBeCloseTo(n * (probabilities[i] as number), 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
