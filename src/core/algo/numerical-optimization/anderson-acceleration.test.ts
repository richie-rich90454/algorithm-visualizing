/**
 * anderson-acceleration.test.ts - Fixed-point correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./anderson-acceleration";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Brute-force solve (I-A)x = b by Gaussian elimination, independent of the module. */
function exactFixedPoint(A: Matrix, b: number[]): number[] {
    const n = b.length;
    const M = A.map((row, i) => row.map((v, j) => v + (i === j ? -1 : 0)));
    const rhs = b.map((v) => -v);
    for (let c = 0; c < n; c += 1) {
        let p = c;
        for (let r = c + 1; r < n; r += 1) {
            if (Math.abs((M[r] as number[])[c] as number) > Math.abs((M[p] as number[])[c] as number)) {
                p = r;
            }
        }
        [M[c], M[p]] = [M[p] as number[], M[c] as number[]];
        [rhs[c], rhs[p]] = [rhs[p] as number, rhs[c] as number];
        const pv = (M[c] as number[])[c] as number;
        for (let r = c + 1; r < n; r += 1) {
            const factor = ((M[r] as number[])[c] as number) / pv;
            for (let k = c; k < n; k += 1) {
                (M[r] as number[])[k] = ((M[r] as number[])[k] as number) - factor * ((M[c] as number[])[k] as number);
            }
            rhs[r] = (rhs[r] as number) - factor * (rhs[c] as number);
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = rhs[i] as number;
        for (let j = i + 1; j < n; j += 1) {
            sum -= ((M[i] as number[])[j] as number) * (x[j] as number);
        }
        x[i] = sum / ((M[i] as number[])[i] as number);
    }
    return x;
}

describe("Anderson Acceleration", () => {
    it("converges to the exact fixed point computed by a direct solve", () => {
        const input = mod.defaultInput as { matrix: Matrix; offset: number[]; initial: number[] };
        const frames = [...mod.run({ ...input, iterations: 25 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = exactFixedPoint(input.matrix, input.offset);
        const x = final?.["x"] as number[];
        x.forEach((v, i) => expect(v).toBeCloseTo(expected[i] as number, 5));
        expect(Number(final?.["residual"])).toBeLessThan(1e-6);
        // Verify the fixed-point equation directly: g(x) = A x + b must equal x.
        const gx = input.matrix.map((row, i) =>
            row.reduce((sum, a, j) => sum + a * (x[j] as number), 0) + (input.offset[i] as number)
        );
        gx.forEach((v, i) => expect(v).toBeCloseTo(x[i] as number, 5));
    });

    it("uses Anderson mixing when history is available", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.some((f) => f.meta["mode"] === "anderson")).toBe(true);
    });

    it("residual does not grow over the run", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const residuals = frames
            .map((f) => f.meta["residual"])
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        expect(residuals.length).toBeGreaterThan(2);
        expect(residuals[residuals.length - 1] as number).toBeLessThanOrEqual((residuals[0] as number) + 1e-9);
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
