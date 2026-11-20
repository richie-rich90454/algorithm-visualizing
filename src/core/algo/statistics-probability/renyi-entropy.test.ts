/**
 * renyi-entropy.test.ts - Independent entropy computation, Shannon limit,
 * order-zero support count, monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./renyi-entropy";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(pValues: number[], alpha: number): number {
    const total = pValues.reduce((s, v) => s + Math.max(0, v), 0);
    const ps = total > 0 ? pValues.map((v) => Math.max(0, v) / total) : pValues.map(() => 0);
    let sum = 0;
    for (const p of ps) {
        sum += p === 0 ? 0 : p ** alpha;
    }
    if (Math.abs(alpha - 1) < 1e-12) {
        return -ps.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);
    }
    return sum > 0 ? Math.log(sum) / (1 - alpha) : 0;
}

describe("RenyiEntropy", () => {
    it("matches an independent entropy computation", () => {
        const probabilities = [0.4, 0.25, 0.15, 0.1, 0.1];
        const alpha = 1.7;
        const frames = [...mod.run({ probabilities, alpha })];
        checkFrames(frames, probabilities.length);
        expect(Number(frames[frames.length - 1].meta["entropy"])).toBeCloseTo(reference(probabilities, alpha), 12);
    });

    it("reduces to Shannon entropy at order one", () => {
        const shannon = -[0.5, 0.3, 0.2].reduce((s, p) => s + p * Math.log(p), 0);
        const result = Number([...mod.run({ probabilities: [0.5, 0.3, 0.2], alpha: 1 })].at(-1)?.meta["entropy"]);
        expect(result).toBeCloseTo(shannon, 12);
    });

    it("order zero counts support and entropy falls with order", () => {
        const h0 = Number([...mod.run({ probabilities: [0.5, 0.25, 0.25, 0], alpha: 0 })].at(-1)?.meta["entropy"]);
        expect(h0).toBeCloseTo(Math.log(3), 12);
        const h1 = Number([...mod.run({ probabilities: [0.5, 0.25, 0.25], alpha: 1 })].at(-1)?.meta["entropy"]);
        const h2 = Number([...mod.run({ probabilities: [0.5, 0.25, 0.25], alpha: 2 })].at(-1)?.meta["entropy"]);
        expect(h2).toBeLessThan(h1);
    });

    it("uniform distributions give log of the outcome count", () => {
        const h = Number([...mod.run({ probabilities: [1, 1, 1, 1], alpha: 2 })].at(-1)?.meta["entropy"]);
        expect(h).toBeCloseTo(Math.log(4), 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
