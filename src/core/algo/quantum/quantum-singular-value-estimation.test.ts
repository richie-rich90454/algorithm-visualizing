/**
 * quantum-singular-value-estimation.test.ts - Independent singular-value
 * cross-check, probability normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-singular-value-estimation";
import type { VisualFrame } from "@/types";

function referenceSingularValues(a: number, b: number, c: number, d: number): number[] {
    const m00 = a * a + c * c;
    const m01 = a * b + c * d;
    const m11 = b * b + d * d;
    const root = Math.sqrt((m00 - m11) ** 2 + 4 * m01 * m01);
    return [Math.sqrt(Math.max(0, (m00 + m11 + root) / 2)), Math.sqrt(Math.max(0, (m00 + m11 - root) / 2))];
}

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["bits"] as number)).toBe(4);
    });
}

describe("QuantumSingularValueEstimation", () => {
    it("matches an independent singular-value computation", () => {
        const cases: Array<[number, number, number, number]> = [
            [1, 0, 0, 2],
            [2, 1, 1, 2],
            [0, 1, -1, 0],
            [1.5, -0.5, 0.25, 2],
        ];
        for (const [a, b, c, d] of cases) {
            const frames = [...mod.run({ a, b, c, d })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]!.meta;
            const got = [...(meta["singularValues"] as number[])].sort((x, y) => x - y);
            const want = referenceSingularValues(a, b, c, d).sort((x, y) => x - y);
            expect(got[0]).toBeCloseTo(want[0]!, 9);
            expect(got[1]).toBeCloseTo(want[1]!, 9);
        }
    });

    it("returns the diagonal entries as singular values for a diagonal matrix", () => {
        const frames = [...mod.run({ a: 1, b: 0, c: 0, d: 2 })];
        checkFrames(frames);
        const values = [...(frames[frames.length - 1]!.meta["singularValues"] as number[])].sort((x, y) => x - y);
        expect(values).toEqual([1, 2]);
    });

    it("normalizes the phase histogram and keeps outcomes in range", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const phase = frames.find((frame) => frame.meta["phase"] === "phase")!;
        const probabilities = phase.meta["phaseProbabilities"] as number[];
        expect(probabilities.length).toBe(16);
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
        expect(probabilities.every((value) => value >= -1e-12 && value <= 1 + 1e-12)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
