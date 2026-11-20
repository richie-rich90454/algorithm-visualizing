/**
 * basis-pursuit.test.ts - Brute-force sparse recovery, feasibility, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./basis-pursuit";
import type { VisualFrame } from "@/types";

const A = [
    [-0.959195, -0.966904, 0.086312, 0.269808, 0.820059, -0.775077, -0.008221, 0.096698, 0.1922, 0.566901, -0.920291, 0.487602],
    [0.931619, -0.852665, 0.399214, -0.079412, -0.207033, 0.919043, -0.187749, 0.905528, 0.987357, 0.327401, -0.154209, -0.000151],
    [-0.42543, -0.153395, 0.350637, -0.689393, -0.822462, 0.705372, -0.376875, -0.985859, -0.074666, -0.416644, 0.145969, 0.924554],
    [-0.969069, 0.55951, -0.395504, -0.357729, 0.909976, 0.093655, 0.334524, 0.31393, 0.246832, -0.677501, 0.858128, 0.534845],
    [-0.085866, 0.45136, -0.336454, 0.425303, 0.152106, 0.522844, -0.114523, -0.588068, -0.086098, 0.343728, 0.042019, 0.745403],
    [-0.216792, 0.851286, 0.484503, -0.71429, 0.370359, -0.29967, -0.283546, 0.586274, 0.593222, -0.647801, -0.762041, -0.19187],
];

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["x"])).toBe(true);
        expect(Number.isFinite(Number(frame.meta["residual"]))).toBe(true);
    });
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => row.reduce((s, v, j) => s + v * (x[j] ?? 0), 0));
}

/** Solve a 2 by 2 system. */
function solve2(a: number[][], b: number[]): number[] {
    const det = a[0]![0]! * a[1]![1]! - a[0]![1]! * a[1]![0]!;
    return [
        (b[0]! * a[1]![1]! - a[0]![1]! * b[1]!) / det,
        (a[0]![0]! * b[1]! - b[0]! * a[1]![0]!) / det,
    ];
}

/** Brute force the best two-column support, its coefficients, and L1 norm. */
function bruteForceBestPair(a: number[][], b: number[]) {
    const m = a.length;
    const n = a[0]!.length;
    let best = { residual: Infinity, l1: Infinity, pair: [-1, -1], coeff: [0, 0] };
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            let g00 = 0;
            let g01 = 0;
            let g11 = 0;
            let r0 = 0;
            let r1 = 0;
            for (let row = 0; row < m; row += 1) {
                const ai = a[row]![i]!;
                const aj = a[row]![j]!;
                g00 += ai * ai;
                g01 += ai * aj;
                g11 += aj * aj;
                r0 += ai * b[row]!;
                r1 += aj * b[row]!;
            }
            const det = g00 * g11 - g01 * g01;
            if (Math.abs(det) < 1e-10) continue;
            const coeff = solve2([[g00, g01], [g01, g11]], [r0, r1]);
            const fit = Array.from({ length: m }, (_, row) => coeff[0]! * a[row]![i]! + coeff[1]! * a[row]![j]!);
            const resid = Math.sqrt(fit.reduce((s, v, row) => s + (v - b[row]!) ** 2, 0));
            if (resid < best.residual - 1e-9) {
                best = { residual: resid, l1: Math.abs(coeff[0]!) + Math.abs(coeff[1]!), pair: [i, j], coeff };
            }
        }
    }
    return best;
}

describe("BasisPursuit", () => {
    it("recovers a two-sparse signal and satisfies the measurements", () => {
        const frames = [...mod.run({ iterations: 600 })];
        checkFrames(frames, 12);
        const meta = frames[frames.length - 1]?.meta;
        const x = meta?.["x"] as number[];
        expect(Number(meta?.["residual"])).toBeLessThan(1e-3);
        const support = (meta?.["support"] as number[]) ?? [];
        expect(support).toEqual([0, 7]);
        for (let i = 0; i < x.length; i += 1) {
            if (!support.includes(i)) {
                expect(Math.abs(x[i]!)).toBeLessThan(1e-2);
            }
        }
        expect(Math.abs(x[0]! - 2)).toBeLessThan(0.05);
        expect(Math.abs(x[7]! + 1.5)).toBeLessThan(0.05);
    });

    it("L1 norm is no worse than any brute-force two-sparse support", () => {
        const frames = [...mod.run({ iterations: 600 })];
        const meta = frames[frames.length - 1]?.meta;
        const x0 = Array<number>(12).fill(0);
        x0[0] = 2;
        x0[7] = -1.5;
        const b = matVec(A, x0);
        const best = bruteForceBestPair(A, b);
        expect(best.residual).toBeLessThan(1e-9);
        expect(best.pair).toEqual([0, 7]);
        expect(Number(meta?.["l1"])).toBeLessThanOrEqual(best.l1 + 0.05);
    });

    it("works with a different sparse signal on the same dictionary", () => {
        const x0 = Array<number>(12).fill(0);
        x0[3] = 1;
        x0[10] = 2.5;
        const b = matVec(A, x0);
        const frames = [...mod.run({ matrix: A, b, iterations: 600 })];
        checkFrames(frames, 12);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["residual"])).toBeLessThan(1e-3);
        const x = meta?.["x"] as number[];
        expect(Math.abs(x[3]! - 1)).toBeLessThan(0.05);
        expect(Math.abs(x[10]! - 2.5)).toBeLessThan(0.05);
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
