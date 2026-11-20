import { describe, expect, it } from "vitest";
import mod from "./hermite-normal-form";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function det(matrix: number[][]): number {
    const n = matrix.length;
    if (n === 1) return matrix[0]![0]!;
    let total = 0;
    for (let c = 0; c < n; c += 1) {
        const minor = matrix.slice(1).map((row) => row.filter((_, j) => j !== c));
        total += (c % 2 === 0 ? 1 : -1) * matrix[0]![c]! * det(minor);
    }
    return total;
}

function multiply(a: number[][], b: number[][]): number[][] {
    return a.map((row) => b[0]!.map((_, c) => row.reduce((sum, value, k) => sum + value * (b[k]![c] ?? 0), 0)));
}

interface FinalMeta {
    Hflat: number[];
    Uflat: number[];
    m: number;
    n: number;
    rank: number;
    detU: number;
}

function finalMeta(frames: VisualFrame[]): FinalMeta {
    return frames[frames.length - 1]?.meta as unknown as FinalMeta;
}

function reshape(flat: number[], rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, (_, r) => flat.slice(r * cols, (r + 1) * cols));
}

describe("Hermite Normal Form", () => {
    it("produces H = U*A with U unimodular and canonical pivot conditions", () => {
        let seed = 33199;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        let tested = 0;
        for (let trial = 0; trial < 60 && tested < 20; trial += 1) {
            const matrix = Array.from({ length: 3 }, () =>
                Array.from({ length: 3 }, () => (next() % 13) - 6),
            );
            if (det(matrix) === 0) continue;
            tested += 1;
            const frames = [...mod.run({ matrix })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const H = reshape(meta.Hflat, meta.m, meta.n);
            const U = reshape(meta.Uflat, meta.m, meta.m);
            const { rank, detU } = meta;
            expect(rank).toBe(3);
            expect(Math.abs(detU)).toBe(1);
            const product = multiply(U, matrix);
            for (let r = 0; r < 3; r += 1) {
                for (let c = 0; c < 3; c += 1) {
                    expect(H[r]![c]).toBe(product[r]![c]);
                }
            }
            for (let i = 0; i < rank; i += 1) {
                expect(H[i]![i]!).toBeGreaterThan(0);
                for (let k = i + 1; k < 3; k += 1) expect(H[k]![i]).toBe(0);
                for (let k = 0; k < i; k += 1) {
                    expect(H[k]![i]!).toBeGreaterThanOrEqual(0);
                    expect(H[k]![i]!).toBeLessThan(H[i]![i]!);
                }
            }
            expect(Math.abs(det(H))).toBe(Math.abs(det(matrix)));
        }
        expect(tested).toBe(20);
    });

    it("handles a rectangular full-row-rank matrix", () => {
        const matrix = [
            [2, 4, 4, 6],
            [6, 6, 12, 10],
        ];
        const frames = [...mod.run({ matrix })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        const H = reshape(meta.Hflat, meta.m, meta.n);
        const U = reshape(meta.Uflat, meta.m, meta.m);
        const { rank, detU } = meta;
        expect(rank).toBe(2);
        expect(Math.abs(detU)).toBe(1);
        const product = multiply(U, matrix);
        for (let r = 0; r < 2; r += 1) {
            for (let c = 0; c < 4; c += 1) expect(H[r]![c]).toBe(product[r]![c]);
        }
        expect(H[0]![0]!).toBeGreaterThan(0);
        expect(H[1]![0]).toBe(0);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
