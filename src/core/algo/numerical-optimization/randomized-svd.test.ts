/**
 * randomized-svd.test.ts - Independent power-iteration reference, reconstruction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./randomized-svd";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rank: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["rank"])).toBe(rank);
        expect(Array.isArray(frame.meta["singularValues"])).toBe(true);
    });
}

/** Independent top singular values via power iteration with deflation on A A^T. */
function topSingularValues(a: number[][], k: number): number[] {
    const m = a.length;
    const n = a[0]!.length;
    let M = Array.from({ length: m }, (_, i) =>
        Array.from({ length: m }, (_, j) => {
            let sum = 0;
            for (let c = 0; c < n; c += 1) sum += a[i]![c]! * a[j]![c]!;
            return sum;
        }),
    );
    const out: number[] = [];
    for (let comp = 0; comp < k; comp += 1) {
        let v = Array.from({ length: m }, (_, i) => Math.cos(i + 0.3 * comp));
        for (let iter = 0; iter < 500; iter += 1) {
            const w = M.map((row) => row.reduce((s, x, j) => s + x * v[j]!, 0));
            const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
            if (norm < 1e-15) break;
            v = w.map((x) => x / norm);
        }
        const lambda = v.reduce((s, vi, i) => s + vi * M[i]!.reduce((t, x, j) => t + x * v[j]!, 0), 0);
        out.push(Math.sqrt(Math.max(0, lambda)));
        M = M.map((row, i) => row.map((x, j) => x - lambda * v[i]! * v[j]!));
    }
    return out;
}

describe("RandomizedSvd", () => {
    it("leading singular values match an independent power-iteration reference", () => {
        const matrices = [
            [
                [3, 1, 0, 2],
                [1, 4, 2, 0],
                [0, 2, 5, 1],
                [2, 0, 1, 6],
                [1, 1, 3, 2],
            ],
            [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
            ],
        ];
        for (const matrix of matrices) {
            const rank = 2;
            const frames = [...mod.run({ matrix, rank, oversample: 3, powerIterations: 2, seed: 11 })];
            checkFrames(frames, rank);
            const meta = frames[frames.length - 1]?.meta;
            const got = meta?.["singularValues"] as number[];
            const expected = topSingularValues(matrix, rank);
            for (let i = 0; i < rank; i += 1) {
                expect(got[i]!).toBeGreaterThanOrEqual(0);
                expect(got[i]!).toBeCloseTo(expected[i]!, 1);
            }
            expect(got[0]!).toBeGreaterThanOrEqual(got[1]!);
        }
    });

    it("reconstruction improves with rank and is exact at full rank", () => {
        const matrix = [
            [3, 1, 0, 2],
            [1, 4, 2, 0],
            [0, 2, 5, 1],
            [2, 0, 1, 6],
            [1, 1, 3, 2],
        ];
        const r1 = [...mod.run({ matrix, rank: 1, oversample: 3, powerIterations: 2, seed: 3 })];
        const r3 = [...mod.run({ matrix, rank: 3, oversample: 3, powerIterations: 2, seed: 3 })];
        const e1 = Number(r1[r1.length - 1]?.meta["error"]);
        const e3 = Number(r3[r3.length - 1]?.meta["error"]);
        expect(e3).toBeLessThan(e1);
        const full = [...mod.run({ matrix, rank: 4, oversample: 0, powerIterations: 0, seed: 3 })];
        expect(Number(full[full.length - 1]?.meta["error"])).toBeLessThan(1e-6);
    });

    it("is deterministic for a fixed seed", () => {
        const input = { rank: 2, oversample: 2, powerIterations: 2, seed: 42 };
        const a = [...mod.run(input)];
        const b = [...mod.run(input)];
        expect(a[a.length - 1]?.meta["singularValues"]).toEqual(b[b.length - 1]?.meta["singularValues"]);
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
