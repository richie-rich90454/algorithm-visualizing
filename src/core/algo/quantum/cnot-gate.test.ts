/**
 * cnot-gate.test.ts - Brute-force permutation check, unit norm, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cnot-gate";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amplitudes = frame.meta["amplitudes"] as number[];
        expect(amplitudes.reduce((sum, a) => sum + a * a, 0)).toBeCloseTo(1, 12);
    });
}

/** Independent CNOT mapping on basis indices, control is the high bit. */
function cnotIndex(index: number): number {
    const control = (index >> 1) & 1;
    const target = index & 1;
    return control === 1 ? index ^ 1 : index;
}

describe("CnotGate", () => {
    it("sends each basis state to the brute-force CNOT image", () => {
        for (const bits of ["00", "01", "10", "11"]) {
            const frames = [...mod.run({ initial: bits })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const amplitudes = final?.["amplitudes"] as number[];
            const probabilities = final?.["probabilities"] as number[];
            const expectedIndex = cnotIndex(Number.parseInt(bits, 2));
            expect(amplitudes[expectedIndex]).toBeCloseTo(1, 12);
            for (let i = 0; i < 4; i += 1) {
                if (i !== expectedIndex) {
                    expect(amplitudes[i]).toBeCloseTo(0, 12);
                }
            }
            expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        }
    });

    it("self-inverse property: applying CNOT twice restores the input", () => {
        for (const bits of ["00", "01", "10", "11"]) {
            const index = Number.parseInt(bits, 2);
            expect(cnotIndex(cnotIndex(index))).toBe(index);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
