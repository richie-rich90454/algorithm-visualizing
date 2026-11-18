/**
 * quantum-phase-estimation.test.ts - Exhaustive exact-phase, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-phase-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], dimension: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dimension);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quantum Phase Estimation", () => {
    it("recovers every exactly representable phase with certainty", () => {
        for (let t = 1; t <= 6; t += 1) {
            const dimension = 1 << t;
            for (let k = 0; k < dimension; k += 1) {
                const frames = [...mod.run({ t, k })];
                checkFrames(frames, dimension);
                const finalMeta = frames[frames.length - 1]!.meta;
                expect(Number(finalMeta["estimate"])).toBeCloseTo(k / dimension, 9);
                expect(Number(finalMeta["probability"])).toBeCloseTo(1, 8);
                expect(Number(finalMeta["phase"])).toBeCloseTo(k / dimension, 12);

                const probabilities = finalMeta["outcomes"] as number[];
                expect(probabilities.length).toBe(dimension);
                const sum = probabilities.reduce((total, value) => total + value, 0);
                expect(sum).toBeCloseTo(1, 8);
                const maxIndex = probabilities.indexOf(Math.max(...probabilities));
                expect(maxIndex).toBe(k);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
