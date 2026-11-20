/** focal-loss.test.ts - Formula, reductions, monotonicity, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { focalFor } from "./focal-loss";
import type { VisualFrame } from "@/types";

interface Input {
    probabilities: number[];
    labels: number[];
    gamma: number;
    alpha: number;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Focal Loss", () => {
    it("matches a brute-force evaluation of the definition", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.probabilities.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.probabilities.forEach((p, i) => {
            const label = input.labels[i] ?? 0;
            const alphaT = label > 0 ? input.alpha : 1 - input.alpha;
            const expected = -alphaT * Math.pow(1 - p, input.gamma) * Math.log(p);
            expect(got[i]).toBeCloseTo(expected, 9);
        });
        const mean = got.reduce((a, b) => a + b, 0) / got.length;
        expect(frames[frames.length - 1]?.meta["mean"]).toBeCloseTo(mean, 9);
    });

    it("reduces to weighted cross-entropy at gamma zero and plain CE at alpha one", () => {
        const p = 0.4;
        const gammaZero = focalFor(p, 1, 0, 0.3);
        expect(gammaZero.focal).toBeCloseTo(0.3 * -Math.log(p), 9);
        const plain = focalFor(p, 1, 0, 1);
        expect(plain.focal).toBeCloseTo(-Math.log(p), 9);
    });

    it("is monotone in confidence and bounded by cross-entropy", () => {
        let previous = Infinity;
        for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
            const result = focalFor(p, 1, 2, 1);
            expect(result.focal).toBeLessThan(previous);
            expect(result.focal).toBeLessThanOrEqual(result.crossEntropy + 1e-12);
            previous = result.focal;
        }
        const hard = focalFor(0.1, 1, 2, 1).focal;
        const easy = focalFor(0.9, 1, 2, 1).focal;
        expect(hard).toBeGreaterThan(easy);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
