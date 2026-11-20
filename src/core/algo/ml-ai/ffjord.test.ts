/** ffjord.test.ts - Hutchinson trace, flow integration reference, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { ffjordFlow, hutchinsonTrace, matVec } from "./ffjord";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FFJORD", () => {
    it("matrix-vector product is correct", () => {
        expect(matVec([[1, 2], [3, 4]], [5, 6])).toEqual([17, 39]);
    });

    it("Hutchinson trace converges to the exact trace", () => {
        const A = [[-1, 0.2], [0.1, -2]];
        const sum = processExitSafeSum(A);
        expect(Math.abs(hutchinsonTrace(A, 40000, 11) - sum)).toBeLessThan(0.1);
        expect(hutchinsonTrace(A, 4000, 11)).toBe(hutchinsonTrace(A, 4000, 11));
    });

    it("the flow matches a high-resolution Euler reference", () => {
        const A = [[-1, 0.2], [0.1, -2]];
        const x0 = [1, 0.5];
        const T = 1;
        const flow = ffjordFlow(A, x0, T, 200, 256, 11);
        const h = T / 2000;
        let x = x0;
        for (let i = 0; i < 2000; i += 1) {
            const dx = matVec(A, x).map((v) => h * v);
            x = x.map((v, j) => v + (dx[j] ?? 0));
        }
        flow.trajectory[flow.trajectory.length - 1]?.forEach((v, j) => expect(v).toBeCloseTo(x[j] ?? 0, 2));
    });

    it("the log density equals minus the trace times total time", () => {
        const A = [[-1, 0.2], [0.1, -2]];
        const flow = ffjordFlow(A, [1, 0.5], 1, 10, 4000, 11);
        expect(flow.logp).toBeCloseTo(-flow.trace, 6);
        expect(flow.logps[0]).toBe(0);
    });

    it("emits well-formed frames consistent with the reference", () => {
        const input = mod.defaultInput as {
            matrix: number[][]; x0: number[]; totalTime: number; steps: number; traceSamples: number; seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = ffjordFlow(
            input.matrix, input.x0, input.totalTime, input.steps, input.traceSamples, input.seed,
        );
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["trace"]).toBeCloseTo(expected.trace, 10);
        expect(final?.["logp"]).toBeCloseTo(expected.logp, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});

function processExitSafeSum(matrix: number[][]): number {
    return matrix.reduce((sum, row, i) => sum + (row[i] ?? 0), 0);
}
