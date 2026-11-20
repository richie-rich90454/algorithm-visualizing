/** masked-autoregressive-flow.test.ts - Invertibility, Jacobian, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { mafForward, mafInverse, maskedLinear } from "./masked-autoregressive-flow";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Masked autoregressive flow", () => {
    it("masked linear ignores diagonal and future entries", () => {
        const weights = [[0, 0, 0], [2, 0, 0], [3, 4, 0]];
        expect(maskedLinear(weights, [1, 2, 3])).toEqual([0, 2, 11]);
    });

    it("forward and inverse are exact mutual inverses", () => {
        const input = mod.defaultInput as { x: number[]; meanWeights: number[][]; scaleWeights: number[][] };
        const { z, means, scales, logDet } = mafForward(input.x, input.meanWeights, input.scaleWeights);
        const recovered = mafInverse(z, input.meanWeights, input.scaleWeights);
        recovered.forEach((v, i) => expect(v).toBeCloseTo(input.x[i] ?? 0, 10));
        const expectedLogDet = -input.scaleWeights.reduce((sum, row, i) => {
            let s = 0;
            for (let j = 0; j < i; j += 1) s += (row[j] ?? 0) * (input.x[j] ?? 0);
            return sum + s;
        }, 0);
        expect(logDet).toBeCloseTo(expectedLogDet, 10);
        scales.forEach((s) => expect(s).toBeGreaterThan(0));
        means.forEach((m) => expect(Number.isFinite(m)).toBe(true));
    });

    it("round-trips a second random-looking input", () => {
        const x = [-2, 0.3, 1.7, 0];
        const Wm = [[0, 0, 0, 0], [1, 0, 0, 0], [0.5, -0.5, 0, 0], [0.2, 0.3, -0.1, 0]];
        const Ws = [[0, 0, 0, 0], [0.2, 0, 0, 0], [0.1, 0.1, 0, 0], [-0.05, 0.2, 0.1, 0]];
        const { z } = mafForward(x, Wm, Ws);
        mafInverse(z, Wm, Ws).forEach((v, i) => expect(v).toBeCloseTo(x[i] ?? 0, 10));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
