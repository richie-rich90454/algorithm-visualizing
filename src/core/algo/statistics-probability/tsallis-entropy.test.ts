/**
 * tsallis-entropy.test.ts - Independent entropy computation, Shannon limit,
 * order-zero support count, uniform case, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tsallis-entropy";
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

function reference(pValues: number[], q: number): number {
    const total = pValues.reduce((s, v) => s + Math.max(0, v), 0);
    const ps = total > 0 ? pValues.map((v) => Math.max(0, v) / total) : pValues.map(() => 0);
    let sum = 0;
    for (const p of ps) {
        sum += p === 0 ? 0 : p ** q;
    }
    if (Math.abs(q - 1) < 1e-12) {
        return -ps.reduce((s, p) => s + (p > 0 ? p * Math.log(p) : 0), 0);
    }
    return (1 - sum) / (q - 1);
}

describe("TsallisEntropy", () => {
    it("matches an independent entropy computation", () => {
        const probabilities = [0.45, 0.3, 0.15, 0.1];
        const q = 0.6;
        const frames = [...mod.run({ probabilities, q })];
        checkFrames(frames, probabilities.length);
        expect(Number(frames[frames.length - 1].meta["entropy"])).toBeCloseTo(reference(probabilities, q), 12);
    });

    it("reduces to Shannon entropy at index one", () => {
        const shannon = -[0.5, 0.3, 0.2].reduce((s, p) => s + p * Math.log(p), 0);
        const result = Number([...mod.run({ probabilities: [0.5, 0.3, 0.2], q: 1 })].at(-1)?.meta["entropy"]);
        expect(result).toBeCloseTo(shannon, 12);
    });

    it("index zero counts support minus one and uniform matches the formula", () => {
        const h0 = Number([...mod.run({ probabilities: [0.5, 0.25, 0.25, 0], q: 0 })].at(-1)?.meta["entropy"]);
        expect(h0).toBeCloseTo(2, 12);
        const q = 1.5;
        const uniform = Number([...mod.run({ probabilities: [1, 1, 1, 1], q })].at(-1)?.meta["entropy"]);
        expect(uniform).toBeCloseTo(reference([1, 1, 1, 1], q), 12);
    });

    it("a point mass has zero entropy", () => {
        const h = Number([...mod.run({ probabilities: [1, 0, 0], q: 2 })].at(-1)?.meta["entropy"]);
        expect(h).toBeCloseTo(0, 12);
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
