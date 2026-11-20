/** binary-cross-entropy.test.ts - Bernoulli likelihood, symmetry, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { binaryCrossEntropyFor } from "./binary-cross-entropy";
import type { VisualFrame } from "@/types";

interface Input {
    probabilities: number[];
    labels: number[];
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Binary Cross-Entropy", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force negative log likelihood", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.probabilities.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.probabilities.forEach((p, i) => {
            const y = input.labels[i] ?? 0;
            const clamped = Math.max(1e-12, Math.min(1 - 1e-12, p));
            const expected = -(y * Math.log(clamped) + (1 - y) * Math.log(1 - clamped));
            expect(got[i]).toBeCloseTo(expected, 12);
        });
    });

    it("reduces to the correct single-class formula and is symmetric", () => {
        expect(binaryCrossEntropyFor(0.7, 1).loss).toBeCloseTo(-Math.log(0.7), 12);
        expect(binaryCrossEntropyFor(0.3, 0).loss).toBeCloseTo(-Math.log(0.7), 12);
        for (const p of [0.05, 0.2, 0.5, 0.8, 0.95]) {
            expect(binaryCrossEntropyFor(p, 1).loss).toBeCloseTo(binaryCrossEntropyFor(1 - p, 0).loss, 12);
        }
    });

    it("is lowest near the true label and stays finite at the extremes", () => {
        expect(binaryCrossEntropyFor(1, 1).loss).toBeLessThan(binaryCrossEntropyFor(0.2, 1).loss);
        expect(Number.isFinite(binaryCrossEntropyFor(0, 1).loss)).toBe(true);
        expect(Number.isFinite(binaryCrossEntropyFor(1, 0).loss)).toBe(true);
        expect(binaryCrossEntropyFor(0.5, 1).loss).toBeGreaterThanOrEqual(0);
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
