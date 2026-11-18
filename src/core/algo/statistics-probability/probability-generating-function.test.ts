/**
 * probability-generating-function.test.ts - Outcome enumeration, moment identities, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./probability-generating-function";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Enumerate all 2^n success patterns and accumulate probability by count. */
function enumeratePmf(n: number, p: number): number[] {
    const pmf = new Array<number>(n + 1).fill(0);
    for (let mask = 0; mask < 1 << n; mask += 1) {
        let successes = 0;
        let probability = 1;
        for (let i = 0; i < n; i += 1) {
            const success = ((mask >> i) & 1) === 1;
            probability *= success ? p : 1 - p;
            if (success) {
                successes += 1;
            }
        }
        pmf[successes] = (pmf[successes] ?? 0) + probability;
    }
    return pmf;
}

/** Evaluate the polynomial directly by a plain power sum. */
function evaluate(pmf: number[], s: number): number {
    return pmf.reduce((sum, coefficient, k) => sum + coefficient * s ** k, 0);
}

describe("Probability generating function", () => {
    it("matches enumeration of binomial outcomes", () => {
        for (const [n, p] of [
            [4, 0.5],
            [6, 0.3],
            [8, 0.7],
            [5, 0],
            [5, 1],
        ]) {
            const frames = [...mod.run({ n, p, s: 0.6 })];
            checkFrames(frames, n as number);
            const pmf = frames[frames.length - 1]?.meta["pmf"] as number[];
            const want = enumeratePmf(n as number, p as number);
            for (let k = 0; k <= (n as number); k += 1) {
                expect(pmf[k]).toBeCloseTo(want[k]!, 10);
            }
        }
    });

    it("satisfies the moment identities and G(1) = 1", () => {
        for (const [n, p] of [
            [4, 0.5],
            [7, 0.25],
            [10, 0.8],
        ]) {
            const s = 0.4;
            const frames = [...mod.run({ n, p, s })];
            checkFrames(frames, n as number);
            const meta = frames[frames.length - 1]?.meta;
            const pmf = meta?.["pmf"] as number[];
            expect(pmf.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
            expect(Number(meta?.["gOfOne"])).toBeCloseTo(1, 10);
            expect(Number(meta?.["gOfS"])).toBeCloseTo(evaluate(pmf, s), 10);
            const mean = Number(meta?.["mean"]);
            const variance = Number(meta?.["variance"]);
            expect(mean).toBeCloseTo((n as number) * (p as number), 10);
            expect(variance).toBeCloseTo((n as number) * (p as number) * (1 - (p as number)), 10);
            expect(Number(meta?.["derivativeMean"])).toBeCloseTo(mean, 3);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
