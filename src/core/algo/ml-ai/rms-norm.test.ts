/**
 * rms-norm.test.ts - Independent reference, scale invariance, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { rmsNorm } from "./rms-norm";
import type { VisualFrame } from "@/types";

function reference(x: number[], gamma: number[], eps: number) {
    let sum = 0;
    for (const value of x) {
        sum += value * value;
    }
    const rms = Math.sqrt(sum / x.length + eps);
    return x.map((value, i) => (value / rms) * (gamma[i] ?? 1));
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RMSNorm", () => {
    it("matches an independent reference on several vectors", () => {
        const cases = [
            { x: [1, 2, -2, 4], gamma: [1, 1, 1, 1] },
            { x: [0.5, -3, 2.5, 0, 7], gamma: [0.8, 1.2, 0.5, 2, -1] },
            { x: [10, -10, 10], gamma: [1, 1, 1] },
        ];
        for (const { x, gamma } of cases) {
            const got = rmsNorm(x, gamma, 1e-6).output;
            const expected = reference(x, gamma, 1e-6);
            got.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 9));
        }
    });

    it("is invariant to positive scaling of the input", () => {
        const x = [1, -2, 3, 0.5];
        const gamma = [1, 1, 1, 1];
        const a = rmsNorm(x, gamma, 0).normalized;
        const b = rmsNorm(x.map((v) => v * 3), gamma, 0).normalized;
        a.forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? 0, 9));
    });

    it("reports the final output in metadata and emits well-formed frames", () => {
        const input = mod.defaultInput as { x: number[]; gamma: number[]; eps: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.x.length);
        const expected = rmsNorm(input.x, input.gamma, input.eps).output;
        const metaOutput = frames[frames.length - 1]?.meta["output"] as number[];
        expect(metaOutput).toHaveLength(expected.length);
        expected.forEach((v, i) => expect(metaOutput[i] ?? 0).toBeCloseTo(v, 6));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
