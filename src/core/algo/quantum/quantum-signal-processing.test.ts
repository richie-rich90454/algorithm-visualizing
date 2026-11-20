/** quantum-signal-processing.test.ts - Exact simulation identity, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./quantum-signal-processing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quantum signal processing", () => {
    it("reproduces Chebyshev polynomials via the cosine identity for several degrees", () => {
        for (const degree of [1, 2, 3, 5]) {
            const xs = [-1, -0.9, -0.5, 0, 0.3, 0.75, 1];
            const phases = Array.from({ length: degree + 1 }, () => 0);
            const frames = [...mod.run({ xs, phases })];
            checkFrames(frames, xs.length);
            const final = frames[frames.length - 1]!.meta;
            expect(final["converged"]).toBe(true);
            expect(Number(final["maxError"])).toBeLessThan(1e-8);
            const results = final["results"] as Array<{ x: number; approx: number; target: number; unitary: boolean }>;
            results.forEach((r, i) => {
                const independent = Math.cos(degree * Math.acos(xs[i]!));
                expect(r.approx).toBeCloseTo(independent, 8);
                expect(r.target).toBeCloseTo(independent, 8);
                expect(r.unitary).toBe(true);
            });
        }
    });

    it("keeps the circuit unitary for nonzero phases", () => {
        const xs = [-0.8, -0.2, 0.4, 0.9];
        const phases = [0.3, -0.7, 1.1, 0.2];
        const frames = [...mod.run({ xs, phases })];
        checkFrames(frames, xs.length);
        const final = frames[frames.length - 1]!.meta;
        const results = final["results"] as Array<{ unitary: boolean }>;
        expect(results.every((r) => r.unitary)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
