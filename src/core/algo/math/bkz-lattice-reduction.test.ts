/** bkz-lattice-reduction.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./bkz-lattice-reduction";
import type { VisualFrame } from "@/types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
    return a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
}

function determinant(m: Vec[]): number {
    const n = m.length;
    if (n === 1) return m[0]![0]!;
    let total = 0;
    for (let c = 0; c < n; c += 1) {
        const minor = m.slice(1).map((row) => row.filter((_, j) => j !== c));
        total += (c % 2 === 0 ? 1 : -1) * m[0]![c]! * determinant(minor);
    }
    return total;
}

function multiplyMatrices(a: Vec[], b: Vec[]): Vec[] {
    return a.map((row) =>
        b[0]!.map((_, col) => row.reduce((sum, x, k) => sum + x * (b[k]![col] ?? 0), 0)),
    );
}

function gso(basis: Vec[]): { bstar: Vec[]; mu: number[][] } {
    const bstar: Vec[] = [];
    const mu: number[][] = [];
    for (let i = 0; i < basis.length; i += 1) {
        const row = new Array<number>(basis.length).fill(0);
        let v = basis[i]!.slice();
        for (let j = 0; j < i; j += 1) {
            const value = dot(basis[i]!, bstar[j]!) / dot(bstar[j]!, bstar[j]!);
            row[j] = value;
            v = v.map((x, k) => x - value * (bstar[j]![k] ?? 0));
        }
        mu.push(row);
        bstar.push(v);
    }
    return { bstar, mu };
}

function isLllReduced(basis: Vec[], delta = 0.75): boolean {
    const { bstar, mu } = gso(basis);
    for (let i = 0; i < basis.length; i += 1) {
        for (let j = 0; j < i; j += 1) {
            if (Math.abs(mu[i]![j]!) > 0.51) return false;
        }
        if (i > 0) {
            const left = dot(bstar[i]!, bstar[i]!);
            const right = (delta - mu[i]![i - 1]! ** 2) * dot(bstar[i - 1]!, bstar[i - 1]!);
            if (left + 1e-7 < right) return false;
        }
    }
    return true;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BKZ lattice reduction", () => {
    it("preserves the lattice via a unimodular transform and returns an LLL-reduced basis", () => {
        const bases: Vec[][] = [
            [
                [1, 1, 1],
                [-2, 0, 1],
                [4, 1, 0],
            ],
            [
                [3, 1, 4],
                [1, 5, 9],
                [2, 6, 5],
            ],
            [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ],
        ];
        for (const basis of bases) {
            const frames = [...mod.run({ basis, blockSize: 3, tours: 3, radius: 2 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const parseMatrix = (value: unknown): Vec[] =>
                (value as string[]).map((row) => row.split(",").map(Number));
            const reduced = parseMatrix(final?.["reducedBasis"]);
            const transform = parseMatrix(final?.["transform"]);
            expect(reduced).toBeDefined();
            expect(transform).toBeDefined();

            // The transformation matrix must be unimodular.
            expect(Math.abs(determinant(transform))).toBe(1);
            // U * original must equal the reported reduced basis exactly.
            expect(multiplyMatrices(transform, basis)).toEqual(reduced);
            // The reduced basis is LLL reduced.
            expect(isLllReduced(reduced)).toBe(true);
            // The first vector never gets longer.
            expect(final?.["finalFirstNorm"]).toBeLessThanOrEqual(dot(basis[0]!, basis[0]!) + 1e-9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
