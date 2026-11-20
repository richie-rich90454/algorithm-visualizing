/**
 * swap-gate.test.ts - Permutation correctness, involution, normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { applyHadamard, applySwap } from "./swap-gate";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SWAP Gate", () => {
    it("permutes amplitudes exactly as a brute-force bit swap", () => {
        for (let index = 0; index < 4; index += 1) {
            const state = [0, 0, 0, 0];
            state[index] = 1;
            const swapped = applySwap(state, 0, 1);
            const expectedIndex = ((index & 1) << 1) | ((index >> 1) & 1);
            expect(swapped[expectedIndex]).toBe(1);
            expect(swapped.reduce((sum, a) => sum + a, 0)).toBeCloseTo(1);
        }
    });

    it("is an involution and preserves the norm on superpositions", () => {
        let state = [0, 1, 0, 0];
        state = applyHadamard(state, 0);
        const once = applySwap(state, 0, 1);
        const twice = applySwap(once, 0, 1);
        for (let i = 0; i < 4; i += 1) expect(twice[i]).toBeCloseTo(state[i]!, 10);
        const norm = (v: number[]): number => v.reduce((sum, a) => sum + a * a, 0);
        expect(norm(once)).toBeCloseTo(norm(state), 10);
        expect(applySwap(state, 0, 0)).toEqual(state);
    });

    it("produces well-formed frames with a correct final amplitude vector", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]!;
        const amplitudes = final.meta["amplitudes"] as number[];
        expect(amplitudes[2]).toBeCloseTo(1);
        expect(amplitudes[1]).toBeCloseTo(0);
        expect(final.meta["doubleSwapReturnsToStart"]).toBe(true);
    });

    it("terminates cleanly with and without a Hadamard", () => {
        for (const input of [mod.defaultInput, { initial: "10", hadamard: true }]) {
            const generator = mod.run(input);
            let count = 0;
            for (const _frame of generator) count += 1;
            expect(count).toBeGreaterThan(0);
            expect(generator.next().done).toBe(true);
        }
    });
});
