/**
 * hessenberg-reduction.test.ts - Independent reduction, similarity, and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./hessenberg-reduction";
import type { VisualFrame } from "@/types";

/** Independent Householder reduction used as a reference implementation. */
function reference(matrix: number[][]) {
    const n = matrix.length;
    const a = matrix.map((row) => [...row]);
    const q = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let k = 0; k <= n - 3; k += 1) {
        const x = Array.from({ length: n - k - 1 }, (_, t) => a[k + 1 + t]![k] ?? 0);
        const norm = Math.sqrt(x.reduce((s, v) => s + v * v, 0));
        if (norm < 1e-14) {
            continue;
        }
        const alpha = x[0]! >= 0 ? -norm : norm;
        const v = [...x];
        v[0] = v[0]! - alpha;
        const vnorm = v.reduce((s, value) => s + value * value, 0);
        if (vnorm < 1e-14) {
            continue;
        }
        const beta = 2 / vnorm;
        for (let col = k; col < n; col += 1) {
            let dot = 0;
            for (let t = 0; t < v.length; t += 1) {
                dot += v[t]! * a[k + 1 + t]![col]!;
            }
            dot *= beta;
            for (let t = 0; t < v.length; t += 1) {
                a[k + 1 + t]![col] -= dot * v[t]!;
            }
        }
        for (let row = 0; row < n; row += 1) {
            let dot = 0;
            for (let t = 0; t < v.length; t += 1) {
                dot += a[row]![k + 1 + t] * v[t]!;
            }
            dot *= beta;
            for (let t = 0; t < v.length; t += 1) {
                a[row]![k + 1 + t] -= dot * v[t]!;
            }
        }
        for (let row = k + 2; row < n; row += 1) {
            a[row]![k] = 0;
        }
        a[k + 1]![k] = alpha;
        for (let row = 0; row < n; row += 1) {
            let dot = 0;
            for (let t = 0; t < v.length; t += 1) {
                dot += q[row]![k + 1 + t] * v[t]!;
            }
            dot *= beta;
            for (let t = 0; t < v.length; t += 1) {
                q[row]![k + 1 + t] -= dot * v[t]!;
            }
        }
    }
    return { hessenberg: a, q };
}

function multiply(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (a[i]![k] ?? 0) * (b[k]![j] ?? 0);
            }
            return sum;
        }),
    );
}

function transpose(a: number[][]): number[][] {
    return a[0]!.map((_, col) => a.map((row) => row[col]!));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hessenberg reduction", () => {
    it("annihilates everything below the first subdiagonal", () => {
        const input = (mod.defaultInput as { matrix: number[][] }).matrix;
        const frames = [...mod.run({ matrix: input })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const h = final?.["matrix"] as number[][];
        expect(Number(final?.["belowSub"])).toBeLessThan(1e-9);
        for (let row = 0; row < h.length; row += 1) {
            for (let col = 0; col < row - 1; col += 1) {
                expect(Math.abs(h[row]![col] ?? 0)).toBeLessThan(1e-9);
            }
        }
    });

    it("matches an independent reduction and preserves similarity", () => {
        const input = (mod.defaultInput as { matrix: number[][] }).matrix;
        const frames = [...mod.run({ matrix: input })];
        const final = frames[frames.length - 1]?.meta;
        const h = final?.["matrix"] as number[][];
        const q = final?.["q"] as number[][];
        const expected = reference(input);
        for (let i = 0; i < h.length; i += 1) {
            for (let j = 0; j < h.length; j += 1) {
                expect(h[i]![j] ?? 0).toBeCloseTo(expected.hessenberg[i]![j] ?? 0, 8);
            }
        }
        const qt = transpose(q);
        const identity = multiply(qt, q);
        for (let i = 0; i < identity.length; i += 1) {
            for (let j = 0; j < identity.length; j += 1) {
                expect(identity[i]![j] ?? 0).toBeCloseTo(i === j ? 1 : 0, 8);
            }
        }
        const similar = multiply(multiply(qt, input), q);
        for (let i = 0; i < similar.length; i += 1) {
            for (let j = 0; j < similar.length; j += 1) {
                expect(similar[i]![j] ?? 0).toBeCloseTo(h[i]![j] ?? 0, 8);
            }
        }
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
