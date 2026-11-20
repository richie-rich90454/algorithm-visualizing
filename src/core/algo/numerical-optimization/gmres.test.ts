/**
 * gmres.test.ts - Direct-solve cross-check, orthonormality, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { gmres, solveLinear } from "./gmres";
import type { VisualFrame } from "@/types";

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
    });
}

describe("GMRES", () => {
    it("matches direct Gaussian elimination on random well-conditioned systems", () => {
        let seed = 4242;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 3;
            const raw = Array.from({ length: n }, () => Array.from({ length: n }, () => (rand() % 9) - 4));
            const a = Array.from({ length: n }, (_, i) =>
                Array.from({ length: n }, (_, j) =>
                    raw[i]!.reduce((sum, v, k) => sum + v * (raw[j]![k] ?? 0), 0) + (i === j ? n : 0),
                ),
            );
            const b = Array.from({ length: n }, () => (rand() % 11) - 5);
            const direct = solveLinear(a, b);
            expect(direct).not.toBeNull();
            const result = gmres(a, b, n);
            const final = result.history[result.history.length - 1];
            expect(final).toBeDefined();
            for (let i = 0; i < n; i += 1) {
                expect(final!.solution[i]).toBeCloseTo(direct![i]!, 8);
            }
            expect(final!.residual).toBeLessThan(1e-8);
            expect(result.orthError).toBeLessThan(1e-8);
        }
    });

    it("has a non-increasing residual across iterations", () => {
        const a = [[4, 1, 1], [1, 3, 0], [1, 0, 2]];
        const b = [6, 4, 5];
        const result = gmres(a, b, 3);
        for (let i = 1; i < result.history.length; i += 1) {
            expect(result.history[i]!.residual).toBeLessThanOrEqual(result.history[i - 1]!.residual + 1e-10);
        }
        const frames = [...mod.run({ matrix: a, vector: b, iterations: 3 })];
        checkFrames(frames, 3);
        expect(Number(frames[frames.length - 1]?.meta["residual"])).toBeLessThan(1e-8);
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
