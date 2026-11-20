/**
 * sum-product-algorithm.test.ts - Brute-force marginal check and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./sum-product-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("sum-product");
    });
}

/** Exhaustive enumeration of a binary chain's joint distribution. */
function bruteForceMarginals(unary: number[][], pairwise: number[][][]): number[] {
    const n = unary.length;
    const marginals = new Array<number>(n).fill(0);
    let partition = 0;
    for (let mask = 0; mask < 2 ** n; mask += 1) {
        const bits = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
        let weight = 1;
        for (let i = 0; i < n; i += 1) weight *= unary[i]![bits[i]!]!;
        for (let i = 0; i < n - 1; i += 1) weight *= pairwise[i]![bits[i]!]![bits[i + 1]!]!;
        partition += weight;
        for (let i = 0; i < n; i += 1) if (bits[i] === 1) marginals[i]! += weight;
    }
    return marginals.map((v) => v / partition);
}

describe("Sum-Product Algorithm", () => {
    it("recovers exact marginals matching full enumeration", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 5);
        const meta = frames[frames.length - 1]?.meta;
        const marginals = meta?.["marginals"] as number[];
        const unary = [[0.6, 0.4], [0.3, 0.7], [0.5, 0.5], [0.8, 0.2], [0.2, 0.8]];
        const pairwise = [
            [[0.7, 0.3], [0.3, 0.7]],
            [[0.8, 0.2], [0.2, 0.8]],
            [[0.6, 0.4], [0.4, 0.6]],
            [[0.9, 0.1], [0.1, 0.9]],
        ];
        const expected = bruteForceMarginals(unary, pairwise);
        marginals.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 5));
        expect(Number(meta?.["maxError"])).toBeLessThan(1e-5);
    });

    it("matches enumeration on a different random-looking chain", () => {
        const unary = [[0.9, 0.1], [0.2, 0.8], [0.55, 0.45], [0.1, 0.9]];
        const pairwise = [
            [[0.4, 0.6], [0.6, 0.4]],
            [[0.85, 0.15], [0.15, 0.85]],
            [[0.5, 0.5], [0.5, 0.5]],
        ];
        const frames = [...mod.run({ unary, pairwise })];
        checkFrames(frames, unary.length);
        const meta = frames[frames.length - 1]?.meta;
        const marginals = meta?.["marginals"] as number[];
        bruteForceMarginals(unary, pairwise).forEach((value, i) => expect(marginals[i]).toBeCloseTo(value, 5));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
