/**
 * mean-squared-error-loss.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mean-squared-error-loss";
import type { VisualFrame } from "@/types";

type Input = { predictions: number[]; targets: number[]; weights?: number[] };

/** Independent reference: compute the weighted mean and its analytic derivative. */
function reference(input: Input) {
    const { predictions, targets, weights } = input;
    const n = Math.min(predictions.length, targets.length);
    const residuals: number[] = [];
    let sum = 0;
    let weightSum = 0;
    for (let i = 0; i < n; i += 1) {
        const r = predictions[i]! - targets[i]!;
        const w = weights ? Math.max(0, weights[i] ?? 0) : 1;
        residuals.push(r);
        sum += w * r * r;
        weightSum += w;
    }
    const denom = weightSum > 0 ? weightSum : 1;
    const gradients = residuals.map((r, i) => (2 * (weights ? Math.max(0, weights[i] ?? 0) : 1) * r) / denom);
    return { loss: sum / denom, gradients, residuals };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mean Squared Error Loss", () => {
    it("matches an independent reference on random inputs", () => {
        for (let seed = 1; seed <= 30; seed += 1) {
            const n = 2 + (seed % 7);
            const predictions = Array.from({ length: n }, (_, i) => ((seed * (i + 3)) % 17) / 4 - 2);
            const targets = Array.from({ length: n }, (_, i) => ((seed * (i + 5)) % 13) / 3 - 2);
            const input: Input = { predictions, targets };
            const frames = [...mod.run(input)];
            checkFrames(frames, n, 5);
            const expected = reference(input);
            const final = frames[frames.length - 1]!.meta;
            expect(Number(final["loss"])).toBeCloseTo(expected.loss, 8);
            const got = final["gradients"] as number[];
            expect(got.length).toBe(n);
            got.forEach((g, i) => expect(g).toBeCloseTo(expected.gradients[i]!, 8));
        }
    });

    it("honors sample weights", () => {
        const input: Input = {
            predictions: [2, 0, -1],
            targets: [0, 0, 0],
            weights: [1, 0, 3],
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        // (1*4 + 0 + 3*1) / (1+0+3) = 7/4 = 1.75
        expect(Number(final["loss"])).toBeCloseTo(1.75, 8);
        expect(final["weighted"]).toBe(true);
    });

    it("gradient matches a finite difference", () => {
        const input: Input = { predictions: [0.7, -1.3, 2.2], targets: [0.1, -0.9, 1.5] };
        const stats = [...mod.run(input)][0]!.meta;
        const grads = stats["gradients"] as number[];
        const eps = 1e-6;
        for (let i = 0; i < input.predictions.length; i += 1) {
            const plus = [...input.predictions];
            const minus = [...input.predictions];
            plus[i]! += eps;
            minus[i]! -= eps;
            const lossPlus = Number([...mod.run({ ...input, predictions: plus })][0]!.meta["loss"]);
            const lossMinus = Number([...mod.run({ ...input, predictions: minus })][0]!.meta["loss"]);
            expect(grads[i]!).toBeCloseTo((lossPlus - lossMinus) / (2 * eps), 5);
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
