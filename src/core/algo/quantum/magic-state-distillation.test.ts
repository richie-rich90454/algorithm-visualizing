/**
 * magic-state-distillation.test.ts - Independent 2^15 enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./magic-state-distillation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(15);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent enumeration using an array-based XOR syndrome. */
function bruteForce(p: number): { accept: number; logical: number; weight3: number } {
    let accept = 0;
    let logical = 0;
    let weight3 = 0;
    for (let mask = 0; mask < 32768; mask += 1) {
        const bits: number[] = [];
        for (let i = 0; i < 15; i += 1) bits.push((mask >> i) & 1);
        const w = bits.reduce((sum, bit) => sum + bit, 0);
        let syndrome = 0;
        for (let i = 0; i < 15; i += 1) {
            if (bits[i] === 1) syndrome ^= i + 1;
        }
        if (syndrome !== 0) continue;
        const probability = p ** w * (1 - p) ** (15 - w);
        accept += probability;
        if (w === 3) weight3 += 1;
        if (w % 4 === 3) logical += probability;
    }
    return { accept, logical, weight3 };
}

describe("MagicStateDistillation", () => {
    it("matches brute-force enumeration of all 32768 patterns", () => {
        for (const p of [0, 0.001, 0.01, 0.05]) {
            const frames = [...mod.run({ p })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const expected = bruteForce(p);
            expect(meta?.["acceptProbability"] as number).toBeCloseTo(expected.accept, 12);
            expect(meta?.["outputErrorProbability"] as number).toBeCloseTo(
                expected.accept > 0 ? expected.logical / expected.accept : 0, 12,
            );
            expect(meta?.["weightThreeCodewords"]).toBe(expected.weight3);
            expect(expected.weight3).toBe(35);
        }
    });

    it("has the cubic leading error term", () => {
        const frames = [...mod.run({ p: 0.01 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["leadingTerm"] as number).toBeCloseTo(35 * 0.01 ** 3, 12);
    });

    it("rejects weight-one and weight-two patterns", () => {
        const one = [...mod.run({ p: 0.01 })][2]?.meta;
        const two = [...mod.run({ p: 0.01 })][3]?.meta;
        expect(one?.["accepted"]).toBe(false);
        expect(two?.["accepted"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
