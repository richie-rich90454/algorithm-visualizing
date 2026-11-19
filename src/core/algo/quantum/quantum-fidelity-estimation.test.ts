/**
 * quantum-fidelity-estimation.test.ts - Brute-force density-matrix trace
 * cross-check, analytic Bell-fidelity formula, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-fidelity-estimation";
import type { VisualFrame } from "@/types";

type C = [number, number];

const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const expectations = frame.meta["expectations"] as number[];
        expect(expectations.length).toBeLessThanOrEqual(4);
        expect(expectations.every((v) => v >= -1.0000000001 && v <= 1.0000000001)).toBe(true);
    });
}

/** Independent brute-force fidelity: Tr(P rho) with P built by an outer product. */
function bruteForceFidelity(noise: number): number {
    const bell = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
    const rho: C[][] = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => [0, 0] as C));
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            const pure = bell[i]! * bell[j]!;
            rho[i]![j] = [(1 - noise) * pure + (i === j ? noise / 4 : 0), 0];
        }
    }
    let total = 0;
    for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
            const pij = bell[i]! * bell[j]!;
            const product = cMul([pij, 0], rho[j]![i]!);
            total += product[0];
        }
    }
    return total;
}

describe("QuantumFidelityEstimation", () => {
    it("matches a brute-force density-matrix trace for many noise levels", () => {
        for (const noise of [0, 0.05, 0.15, 0.4, 0.75, 1]) {
            const frames = [...mod.run({ noise })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["fidelityEstimate"]).toBeCloseTo(bruteForceFidelity(noise), 11);
            expect(final["exactFidelity"]).toBeCloseTo(bruteForceFidelity(noise), 11);
            expect(final["fidelityEstimate"]).toBeCloseTo(1 - (3 * noise) / 4, 11);
        }
    });

    it("returns one for a pure Bell state and one quarter for maximum noise", () => {
        const pure = [...mod.run({ noise: 0 })];
        checkFrames(pure);
        expect(pure[pure.length - 1]!.meta["fidelityEstimate"]).toBeCloseTo(1, 11);
        const mixed = [...mod.run({ noise: 1 })];
        checkFrames(mixed);
        expect(mixed[mixed.length - 1]!.meta["fidelityEstimate"]).toBeCloseTo(0.25, 11);
    });

    it("clamps the noise parameter", () => {
        const frames = [...mod.run({ noise: 5 })];
        expect(frames[0]!.meta["noise"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
