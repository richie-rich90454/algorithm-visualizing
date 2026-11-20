/**
 * taylor-series-simulation.test.ts - Simulation accuracy and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { exactSimulate, taylorSimulate } from "./taylor-series-simulation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent matrix exponential by eigendecomposition-free Taylor recurrence. */
function referenceState(H: number[][], psi: number[], t: number): { re: number; im: number }[] {
    let term = psi.map((value) => ({ re: value, im: 0 }));
    const total = term.map((value) => ({ ...value }));
    for (let k = 1; k <= 200; k += 1) {
        const next = H.map((row) => ({
            re: (row[0] as number) * (term[0] as { re: number }).re + (row[1] as number) * (term[1] as { re: number }).re,
            im: (row[0] as number) * (term[0] as { im: number }).im + (row[1] as number) * (term[1] as { im: number }).im,
        }));
        term = next.map((value) => ({ re: (t * value.im) / k, im: (-t * value.re) / k }));
        total.forEach((value, i) => {
            value.re += (term[i] as { re: number }).re;
            value.im += (term[i] as { im: number }).im;
        });
    }
    return total;
}

describe("Taylor Series Hamiltonian Simulation", () => {
    it("matches the closed-form Pauli X evolution", () => {
        const exact = exactSimulate([[0, 1], [1, 0]], [1, 0], 1.2);
        expect(exact[0]!.re).toBeCloseTo(Math.cos(1.2), 10);
        expect(exact[0]!.im).toBeCloseTo(0, 10);
        expect(exact[1]!.re).toBeCloseTo(0, 10);
        expect(exact[1]!.im).toBeCloseTo(-Math.sin(1.2), 10);
    });

    it("converges monotonically with the series order", () => {
        const H = [[0, 1], [1, 0]];
        const psi = [1, 0];
        const exact = exactSimulate(H, psi, 1.2);
        const errors = [4, 8, 14, 20].map((order) => {
            const state = taylorSimulate(H, psi, 1.2, order);
            return Math.sqrt(state.reduce((sum, value, i) =>
                sum + (value.re - (exact[i] as { re: number }).re) ** 2 + (value.im - (exact[i] as { im: number }).im) ** 2, 0));
        });
        for (let i = 1; i < errors.length; i += 1) {
            expect(errors[i] as number).toBeLessThan(errors[i - 1] as number);
        }
        expect(errors[errors.length - 1]).toBeLessThan(1e-10);
    });

    it("agrees with an independent long series and preserves probability", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accurate"]).toBe(true);
        expect(Number(final?.["norm"])).toBeCloseTo(1, 6);
        const reference = referenceState([[0, 1], [1, 0]], [1, 0], 1.2);
        const amps = final?.["amplitudes"] as Array<{ re: number; im: number }>;
        amps.forEach((value, i) => {
            expect(value.re).toBeCloseTo((reference[i] as { re: number }).re, 8);
            expect(value.im).toBeCloseTo((reference[i] as { im: number }).im, 8);
        });
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
