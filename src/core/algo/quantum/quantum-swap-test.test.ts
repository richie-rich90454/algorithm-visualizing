/**
 * quantum-swap-test.test.ts - Classical overlap cross-check, identical and
 * orthogonal special cases, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-swap-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(16);
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 + amps[i + 1]! ** 2 : sum), 0)).toBeCloseTo(1, 10);
    });
}

function classicalOverlap(alpha: number, theta: number, phi: number): number {
    const re = Math.cos(alpha) * Math.cos(theta) + Math.sin(alpha) * Math.sin(theta) * Math.cos(phi);
    const im = Math.sin(alpha) * Math.sin(theta) * Math.sin(phi);
    return re * re + im * im;
}

describe("QuantumSwapTest", () => {
    it("recovers the classical squared overlap for several state pairs", () => {
        const cases: Array<[number, number, number]> = [
            [0, Math.PI / 4, 0],
            [0.4, 1.1, 0.7],
            [1.2, 0.3, -2.0],
            [Math.PI / 2, 0, 0],
            [0.9, 0.9, Math.PI],
        ];
        for (const [alpha, theta, phi] of cases) {
            const frames = [...mod.run({ alpha, theta, phi })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = classicalOverlap(alpha, theta, phi);
            expect(final["overlapSquared"]).toBeCloseTo(expected, 11);
            expect(final["fidelity"]).toBeCloseTo(expected, 10);
            expect(final["ancillaZeroProb"]).toBeCloseTo((1 + expected) / 2, 10);
        }
    });

    it("returns one for identical states and zero for orthogonal states", () => {
        const same = [...mod.run({ alpha: 0.7, theta: 0.7, phi: 0 })];
        checkFrames(same);
        expect(same[same.length - 1]!.meta["fidelity"]).toBeCloseTo(1, 11);
        const orthogonal = [...mod.run({ alpha: 0, theta: Math.PI / 2, phi: 0 })];
        checkFrames(orthogonal);
        expect(orthogonal[orthogonal.length - 1]!.meta["fidelity"]).toBeCloseTo(0, 11);
    });

    it("clamps out-of-range phases", () => {
        const frames = [...mod.run({ alpha: -3, theta: 9, phi: 8 })];
        checkFrames(frames);
        expect(frames[0]!.meta["alpha"]).toBe(0);
        expect(frames[0]!.meta["theta"]).toBeCloseTo(Math.PI, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
