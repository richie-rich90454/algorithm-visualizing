/**
 * hadamard-gate.test.ts - Matrix reference, unitarity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hadamard-gate";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Apply the Hadamard matrix with an explicit 2 by 2 multiplication. */
function matrixHadamard(state: number[]): number[] {
    const s = 1 / Math.sqrt(2);
    const h = [
        [s, s],
        [s, -s],
    ];
    return [
        h[0]![0]! * state[0]! + h[0]![1]! * state[1]!,
        h[1]![0]! * state[0]! + h[1]![1]! * state[1]!,
    ];
}

describe("HadamardGate", () => {
    it("matches an explicit matrix multiplication for both basis states", () => {
        for (const bit of [0, 1]) {
            const frames = [...mod.run({ bit })];
            checkFrames(frames);
            const initial = bit === 0 ? [1, 0] : [0, 1];
            const afterOne = frames[1]?.meta["amplitudes"] as number[];
            const expected = matrixHadamard(initial);
            expect(afterOne[0]).toBeCloseTo(expected[0], 12);
            expect(afterOne[1]).toBeCloseTo(expected[1], 12);
        }
    });

    it("preserves probability and is its own inverse", () => {
        for (const bit of [0, 1]) {
            const frames = [...mod.run({ bit })];
            checkFrames(frames);
            for (const frame of frames) {
                const amplitudes = frame.meta["amplitudes"] as number[];
                const norm = amplitudes.reduce((total, a) => total + a * a, 0);
                expect(norm).toBeCloseTo(1, 12);
                const probabilities = frame.meta["probabilities"] as number[];
                expect(probabilities.reduce((total, p) => total + p, 0)).toBeCloseTo(1, 12);
            }
            const final = frames[frames.length - 1]?.meta["amplitudes"] as number[];
            expect(final[bit]).toBeCloseTo(1, 12);
            expect(final[1 - bit]).toBeCloseTo(0, 12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});
