/**
 * path-integral-monte-carlo.test.ts - Brute-force path enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./path-integral-monte-carlo";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Enumerate every closed imaginary-time path explicitly. */
function bruteForcePartition(epsilon: number, delta: number, dtau: number, slices: number): number {
    const tunneling = (dtau * delta) / 2;
    const weight = (from: number, to: number): number => {
        const spin = from === 0 ? 1 : -1;
        const spinWeight = Math.exp(-dtau * spin * epsilon / 2);
        return (from === to ? Math.cosh(tunneling) : Math.sinh(tunneling)) * spinWeight;
    };
    let total = 0;
    const paths = 1 << slices;
    for (let encoding = 0; encoding < paths; encoding += 1) {
        const spins = Array.from({ length: slices }, (_, index) => (encoding >> index) & 1);
        let product = 1;
        for (let step = 0; step < slices; step += 1) {
            const from = spins[step] ?? 0;
            const to = spins[(step + 1) % slices] ?? 0;
            product *= weight(from, to);
        }
        total += product;
    }
    return total;
}

describe("Path Integral Monte Carlo", () => {
    it("matches a brute-force enumeration of closed paths", () => {
        const epsilon = 1.2;
        const delta = 0.9;
        const beta = 1;
        const dtau = 0.1;
        const frames = [...mod.run({ epsilon, delta, beta, dtau })];
        checkFrames(frames);
        const slices = Math.round(beta / dtau);
        const expected = bruteForcePartition(epsilon, delta, dtau, slices);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["estimate"])).toBeCloseTo(expected, 8);
        expect(Number(final["slices"])).toBe(slices);
    });

    it("converges toward the exact continuum partition function", () => {
        const coarse = [...mod.run({ epsilon: 1.2, delta: 0.9, beta: 1, dtau: 0.25 })];
        const fine = [...mod.run({ epsilon: 1.2, delta: 0.9, beta: 1, dtau: 0.05 })];
        const coarseError = Math.abs(Number(coarse[coarse.length - 1]!.meta["relativeError"]));
        const fineError = Math.abs(Number(fine[fine.length - 1]!.meta["relativeError"]));
        expect(fineError).toBeLessThan(coarseError);
        expect(fineError).toBeLessThan(1e-3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
