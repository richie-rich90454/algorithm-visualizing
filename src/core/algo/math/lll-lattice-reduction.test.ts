/** lll-lattice-reduction.test.ts - Unimodular and reducedness property checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lll-lattice-reduction";
import type { VisualFrame } from "@/types";

type Vec = number[];
function dot(a: Vec, b: Vec): number {
    return a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
}
function det(m: Vec[]): number {
    const n = m.length;
    if (n === 1) return m[0]![0]!;
    let total = 0;
    for (let c = 0; c < n; c += 1) {
        const minor = m.slice(1).map((row) => row.filter((_, j) => j !== c));
        total += (c % 2 === 0 ? 1 : -1) * m[0]![c]! * det(minor);
    }
    return total;
}
function multiply(a: Vec[], b: Vec[]): Vec[] {
    return a.map((row) => b[0]!.map((_, col) => row.reduce((s, x, k) => s + x * (b[k]![col] ?? 0), 0)));
}
function gso(basis: Vec[]): { mu: number[][]; norm: number[] } {
    const n = basis.length;
    const mu: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const norm = new Array<number>(n).fill(0);
    const bstar: Vec[] = [];
    for (let i = 0; i < n; i += 1) {
        let v = basis[i]!.slice();
        for (let j = 0; j < i; j += 1) {
            mu[i]![j] = dot(basis[i]!, bstar[j]!) / norm[j]!;
            const f = mu[i]![j]!;
            v = v.map((x, k) => x - f * (bstar[j]![k] ?? 0));
        }
        bstar.push(v);
        norm[i] = dot(v, v);
    }
    return { mu, norm };
}
function isReduced(basis: Vec[], delta = 0.75): boolean {
    const { mu, norm } = gso(basis);
    for (let i = 0; i < basis.length; i += 1) {
        for (let j = 0; j < i; j += 1) if (Math.abs(mu[i]![j]!) > 0.51) return false;
        if (i > 0 && norm[i]! + 1e-7 < (delta - mu[i]![i - 1]! ** 2) * norm[i - 1]!) return false;
    }
    return true;
}
function parseMatrix(s: string): Vec[] {
    return (s as string).split(";").filter(Boolean).map((row) => row.split(",").map(Number));
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
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

describe("LLL lattice reduction", () => {
    it("preserves the lattice via a unimodular transform and returns a reduced basis", () => {
        const bases: Vec[][] = [
            [[1, 1, 1], [-2, 0, 1], [4, 1, 0]],
            [[3, 1, 4], [1, 5, 9], [2, 6, 5]],
            [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            [[10, 7, 3], [2, 9, 4], [6, 1, 11]],
        ];
        for (const basis of bases) {
            const frames = [...mod.run({ basis })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const reduced = parseMatrix(final["reducedBasis"] as string);
            const U = parseMatrix(final["transform"] as string);
            expect(Math.abs(det(U))).toBe(1);
            expect(multiply(U, basis)).toEqual(reduced);
            expect(isReduced(reduced)).toBe(true);
            expect(final["reduced"]).toBe(true);
            expect(Math.abs(det(reduced))).toBe(Math.abs(det(basis)));
        }
    });

    it("rejects a non-square basis without throwing", () => {
        const frames = [...mod.run({ basis: [[1, 2, 3], [4, 5, 6]] })];
        expect(frames[0]!.meta["valid"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
