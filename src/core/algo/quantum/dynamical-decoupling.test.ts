/**
 * dynamical-decoupling.test.ts - Analytic integral check, static cancellation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dynamical-decoupling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(7);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const coherences = frame.meta["coherences"] as number[];
        for (const value of coherences) {
            expect(value).toBeGreaterThanOrEqual(-1e-12);
            expect(value).toBeLessThanOrEqual(1 + 1e-12);
        }
    });
}

/** Independent analytic zero-pulse phase: 2 * integral of delta0 + A cos(omega t). */
function analyticFreePhase(delta0: number, amplitude: number, omega: number, total: number): number {
    return 2 * (delta0 * total + (amplitude / omega) * Math.sin(omega * total));
}

describe("DynamicalDecoupling", () => {
    it("matches the analytic zero-pulse integral", () => {
        const delta0 = 0.4;
        const amplitude = 1;
        const omega = 2 * Math.PI;
        const total = 1;
        const frames = [...mod.run({ delta0, amplitude, omega, totalTime: total })];
        checkFrames(frames);
        const phases = frames[frames.length - 1]?.meta["phases"] as number[];
        expect(phases[0]).toBeCloseTo(analyticFreePhase(delta0, amplitude, omega, total), 6);
    });

    it("cancels a purely static detuning for every positive pulse count", () => {
        const delta0 = 0.7;
        const frames = [...mod.run({ delta0, amplitude: 0, omega: 2 * Math.PI, totalTime: 1 })];
        checkFrames(frames);
        const phases = frames[frames.length - 1]?.meta["phases"] as number[];
        expect(phases[0]).toBeCloseTo(2 * delta0, 6);
        for (let i = 1; i < phases.length; i += 1) {
            expect(Math.abs(phases[i] ?? 0)).toBeLessThan(1e-6);
        }
        const coherences = frames[frames.length - 1]?.meta["coherences"] as number[];
        for (const value of coherences) expect(value).toBeCloseTo(1, 6);
    });

    it("reports finite coherence for a modulation ensemble", () => {
        const frames = [...mod.run({ delta0: 0.4, amplitude: 1, omega: 2 * Math.PI, totalTime: 1 })];
        const meta = frames[frames.length - 1]?.meta;
        const coherences = meta?.["coherences"] as number[];
        expect(coherences.length).toBe(5);
        for (const value of coherences) {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThan(0);
        }
        expect(meta?.["ensembleSize"]).toBe(5);
        expect(meta?.["steps"]).toBe(512);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
