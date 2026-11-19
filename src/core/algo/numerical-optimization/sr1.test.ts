/**
 * sr1.test.ts - Independent SR1 reference, secant equation, convergence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sr1";
import type { VisualFrame } from "@/types";

type Matrix2 = [number, number, number, number];
type Vec2 = [number, number];
type Input = { A: number[][]; b: number[]; x0: number[]; iterations: number };

function matVec(m: Matrix2, v: Vec2): Vec2 {
    return [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
}
function dot(a: Vec2, b: Vec2): number {
    return a[0] * b[0] + a[1] * b[1];
}
function solve2(m: Matrix2, rhs: Vec2): Vec2 {
    const det = m[0] * m[3] - m[1] * m[2];
    return [(rhs[0] * m[3] - m[1] * rhs[1]) / det, (m[0] * rhs[1] - rhs[0] * m[2]) / det];
}

/** Reference symmetric rank-one loop on a two-dimensional quadratic. */
function reference(input: Input): { x: Vec2; B: Matrix2; secantResidual: number } {
    const A: Matrix2 = [input.A[0]![0]!, input.A[0]![1]!, input.A[1]![0]!, input.A[1]![1]!];
    const b: Vec2 = [input.b[0]!, input.b[1]!];
    let x: Vec2 = [input.x0[0]!, input.x0[1]!];
    let B: Matrix2 = [1, 0, 0, 1];
    let secantResidual = 0;
    for (let i = 0; i < input.iterations; i += 1) {
        const g: Vec2 = [A[0] * x[0] + A[1] * x[1] - b[0], A[2] * x[0] + A[3] * x[1] - b[1]];
        if (Math.hypot(g[0], g[1]) < 1e-10) break;
        const p = solve2(B, [-g[0], -g[1]]);
        const ap = matVec(A, p);
        const alpha = -dot(g, p) / dot(p, ap);
        const s: Vec2 = [alpha * p[0], alpha * p[1]];
        const y = matVec(A, s);
        const r: Vec2 = [y[0] - (B[0] * s[0] + B[1] * s[1]), y[1] - (B[2] * s[0] + B[3] * s[1])];
        const denom = dot(r, s);
        if (Math.abs(denom) > 1e-12) {
            B = [B[0] + (r[0] * r[0]) / denom, B[1] + (r[0] * r[1]) / denom,
                 B[2] + (r[1] * r[0]) / denom, B[3] + (r[1] * r[1]) / denom];
        }
        const updated = matVec(B, s);
        secantResidual = Math.hypot(updated[0] - y[0], updated[1] - y[1]);
        x = [x[0] + s[0], x[1] + s[1]];
    }
    return { x, B, secantResidual };
}

function checkFrames(frames: VisualFrame[], iterations: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(iterations * 6);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["B"] as number[]).length).toBe(4);
    });
}

describe("Sr1", () => {
    it("matches an independent SR1 reference", () => {
        const inputs: Input[] = [
            { A: [[4, 1], [1, 3]], b: [1, 2], x0: [2, -1], iterations: 6 },
            { A: [[7, 2], [2, 5]], b: [-1, 3], x0: [4, 4], iterations: 6 },
            { A: [[2, 0], [0, 9]], b: [6, -3], x0: [0, 0], iterations: 4 },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.iterations);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["x"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.x[i]!, 8));
            (final?.["B"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.B[i]!, 8));
            expect(final?.["secantResidual"] as number).toBeLessThan(1e-8);
        }
    });

    it("converges to the exact quadratic minimizer", () => {
        const input: Input = { A: [[4, 1], [1, 3]], b: [1, 2], x0: [2, -1], iterations: 8 };
        const final = [...mod.run(input)].pop()?.meta;
        const x = final?.["x"] as number[];
        expect(x[0]).toBeCloseTo(1 / 11, 7);
        expect(x[1]).toBeCloseTo(7 / 11, 7);
        expect(final?.["gradientNorm"] as number).toBeLessThan(1e-7);
    });

    it("skips a singular update when the Hessian is already exact", () => {
        const input: Input = { A: [[1, 0], [0, 1]], b: [1, 2], x0: [0, 0], iterations: 3 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        expect(final?.["secantResidual"] as number).toBeLessThan(1e-12);
        expect((final?.["B"] as number[])[0]).toBe(1);
        expect((final?.["B"] as number[])[3]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
