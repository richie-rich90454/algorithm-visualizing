/**
 * iterative-shrinkage-thresholding.test.ts - Optimality, monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./iterative-shrinkage-thresholding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function objectiveDirect(a: number[][], b: number[], x: number[], lambda: number): number {
    let data = 0;
    for (let i = 0; i < b.length; i += 1) {
        let ax = 0;
        for (let j = 0; j < x.length; j += 1) ax += (a[i]?.[j] ?? 0) * (x[j] ?? 0);
        data += (ax - (b[i] ?? 0)) ** 2;
    }
    return 0.5 * data + lambda * x.reduce((s, v) => s + Math.abs(v), 0);
}

describe("ISTA", () => {
    it("decreases the objective and reaches a fixed point on the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1]?.meta;
        const n = (last?.["n"] as number) ?? 0;
        checkFrames(frames, n);
        const history = last?.["history"] as number[];
        for (let i = 1; i < history.length; i += 1) {
            expect(history[i] as number).toBeLessThanOrEqual((history[i - 1] as number) + 1e-10);
        }
        expect(last?.["residual"] as number).toBeLessThan(1e-5);
        const x = last?.["solution"] as number[];
        const input = mod.defaultInput as { matrix: number[][]; b: number[]; lambda: number };
        const atZero = objectiveDirect(input.matrix, input.b, x.map(() => 0), input.lambda);
        expect(objectiveDirect(input.matrix, input.b, x, input.lambda)).toBeLessThanOrEqual(atZero);
    });

    it("produces a sparse solution on a problem with a known sparse answer", () => {
        const a = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ];
        const b = [2, 0, 0];
        const frames = [...mod.run({ matrix: a, b, lambda: 0.2, iterations: 1500 })];
        const last = frames[frames.length - 1]?.meta;
        checkFrames(frames, 3);
        const x = last?.["solution"] as number[];
        expect(Math.abs(x[0] ?? 0)).toBeGreaterThan(1);
        expect(x[1]).toBe(0);
        expect(x[2]).toBe(0);
        expect(last?.["residual"] as number).toBeLessThan(1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
