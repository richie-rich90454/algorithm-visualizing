/** complete-pivoting.test.ts - Residual, pivot, determinant, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./complete-pivoting";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * (n + 1));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]) {
    return frames[frames.length - 1]?.meta;
}

describe("Complete Pivoting", () => {
    it("solves the default system and satisfies every equation", () => {
        const input = mod.defaultInput as { matrix: number[][]; rhs: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.matrix.length);
        const meta = finalMeta(frames);
        const x = meta?.["solution"] as number[];
        expect(x.length).toBe(3);
        for (let i = 0; i < input.matrix.length; i += 1) {
            let sum = 0;
            for (let j = 0; j < input.matrix.length; j += 1) sum += (input.matrix[i]?.[j] as number) * (x[j] as number);
            expect(sum).toBeCloseTo(input.rhs[i] as number, 6);
        }
    });

    it("always chooses the largest entry of the active submatrix", () => {
        const matrix = [
            [1, 2, 3],
            [4, 100, 6],
            [7, 8, 9],
        ];
        const frames = [...mod.run({ matrix, rhs: [1, 2, 3] })];
        const pivotFrames = frames.filter((f) => f.meta["phase"] === "pivot");
        expect(pivotFrames.length).toBe(3);
        expect(pivotFrames[0]?.meta["pivotValue"]).toBe(100);
    });

    it("matches a brute-force determinant and solution across random systems", () => {
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed / 0x7fffffff) * 2 - 1;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const a = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Math.round(rand() * 10)));
            const xTrue = Array.from({ length: 3 }, () => Math.round(rand() * 10));
            const b = a.map((row) => row.reduce((s, v, j) => s + v * (xTrue[j] as number), 0));
            const meta = finalMeta([...mod.run({ matrix: a, rhs: b })]);
            const x = meta?.["solution"] as number[];
            for (let j = 0; j < 3; j += 1) expect(x[j]).toBeCloseTo(xTrue[j] as number, 5);

            const [p, q, r] = [
                (a[0]?.[0] as number) * ((a[1]?.[1] as number) * (a[2]?.[2] as number) - (a[1]?.[2] as number) * (a[2]?.[1] as number)),
                -(a[0]?.[1] as number) * ((a[1]?.[0] as number) * (a[2]?.[2] as number) - (a[1]?.[2] as number) * (a[2]?.[0] as number)),
                (a[0]?.[2] as number) * ((a[1]?.[0] as number) * (a[2]?.[1] as number) - (a[1]?.[1] as number) * (a[2]?.[0] as number)),
            ];
            expect(meta?.["determinant"]).toBeCloseTo(p + q + r, 3);
        }
    });

    it("reports a singular matrix and terminates", () => {
        const frames = [...mod.run({ matrix: [[1, 2], [2, 4]], rhs: [1, 2] })];
        expect(finalMeta(frames)?.["singular"]).toBe(true);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
