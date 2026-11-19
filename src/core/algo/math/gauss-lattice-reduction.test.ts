/** gauss-lattice-reduction.test.ts - Shortest-vector property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./gauss-lattice-reduction";
import type { VisualFrame } from "@/types";

type Vec = [number, number];
function sq(v: Vec): number {
    return v[0] * v[0] + v[1] * v[1];
}
function det(a: Vec, b: Vec): number {
    return Math.abs(a[0] * b[1] - a[1] * b[0]);
}
function bruteShortest(a: Vec, b: Vec, K = 30): number {
    let best = Infinity;
    for (let i = -K; i <= K; i += 1) {
        for (let j = -K; j <= K; j += 1) {
            if (i === 0 && j === 0) continue;
            const n = sq([i * a[0] + j * b[0], i * a[1] + j * b[1]]);
            if (n < best) best = n;
        }
    }
    return best;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const e of frame.edges) {
            expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
            expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lagrange-Gauss reduction", () => {
    it("finds the true shortest lattice vector and preserves the determinant", () => {
        const bases: Vec[][] = [
            [[1, 3], [4, 1]],
            [[5, 8], [3, 4]],
            [[7, 1], [2, 9]],
            [[3, 0], [0, 5]],
        ];
        for (const [a, b] of bases) {
            const frames = [...mod.run({ basis: [a, b] })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const b1: Vec = final["b1"] as Vec;
            const b2: Vec = final["b2"] as Vec;
            expect(sq(b1)).toBe(bruteShortest(a, b));
            expect(det(b1, b2)).toBe(det(a, b));
            expect(final["reduced"]).toBe(true);
            expect(final["norm1"]).toBeLessThanOrEqual(final["norm2"] as number);
            expect(Math.abs(2 * (b1[0] * b2[0] + b1[1] * b2[1]))).toBeLessThanOrEqual(sq(b1));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
