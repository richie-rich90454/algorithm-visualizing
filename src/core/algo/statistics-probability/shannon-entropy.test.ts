/**
 * shannon-entropy.test.ts - Definition cross-check, properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./shannon-entropy";
import type { VisualFrame } from "@/types";

/** Independent brute-force entropy from the definition. */
function reference(weights: number[], base: 2 | "e" | 10): number {
    const total = weights.reduce((a, b) => a + b, 0);
    const lg = base === 2 ? Math.log2 : base === 10 ? Math.log10 : Math.log;
    let h = 0;
    for (const w of weights) {
        const p = total > 0 ? w / total : 1 / weights.length;
        if (p > 0) h += -p * lg(p);
    }
    return h;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Shannon Entropy", () => {
    it("matches an independent definition on varied inputs", () => {
        const cases = [
            { weights: [0.5, 0.25, 0.125, 0.125], base: 2 as const },
            { weights: [3, 1, 1, 1, 4], base: 2 as const },
            { weights: [1, 1, 1, 1, 1, 1, 1], base: "e" as const },
            { weights: [7, 2], base: 10 as const },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.weights.length);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["entropy"])).toBeCloseTo(reference(testCase.weights, testCase.base), 12);
        }
    });

    it("satisfies the zero and uniform bounds", () => {
        const certain = [...mod.run({ weights: [0, 5, 0], base: 2 })];
        expect(Number(certain[certain.length - 1]?.meta["entropy"])).toBeCloseTo(0, 12);

        for (const n of [1, 2, 5, 8]) {
            const weights = Array.from({ length: n }, () => 1);
            const frames = [...mod.run({ weights, base: 2 })];
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["entropy"])).toBeCloseTo(Math.log2(n), 12);
            expect(Number(final?.meta["maxEntropy"])).toBeCloseTo(Math.log2(n), 12);
            expect(Number(final?.meta["efficiency"])).toBeCloseTo(n === 1 ? 0 : 1, 12);
        }
    });

    it("relates bits and nats by a factor of ln 2", () => {
        const weights = [2, 3, 5, 7];
        const bits = [...mod.run({ weights, base: 2 })];
        const nats = [...mod.run({ weights, base: "e" })];
        const hBits = Number(bits[bits.length - 1]?.meta["entropy"]);
        const hNats = Number(nats[nats.length - 1]?.meta["entropy"]);
        expect(hNats).toBeCloseTo(hBits * Math.LN2, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
