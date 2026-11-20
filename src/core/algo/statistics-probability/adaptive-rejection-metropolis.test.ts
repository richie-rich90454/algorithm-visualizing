/**
 * adaptive-rejection-metropolis.test.ts - Envelope, sampling, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { lowerEnvelopeLog, upperEnvelopeLog } from "./adaptive-rejection-metropolis";
import type { VisualFrame } from "@/types";

const logTarget = (x: number): number => -(x * x) / 2;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(frame.entities.some((e) => e.state === "pivot")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["support"])).toBe(true);
        expect(Array.isArray(frame.meta["samples"])).toBe(true);
    });
}

describe("Adaptive rejection Metropolis sampling", () => {
    it("keeps the tangent envelope above and the chord envelope below the target", () => {
        const support = [-2, -0.5, 1, 2.5];
        for (let i = -100; i <= 100; i += 1) {
            const x = i / 20;
            expect(upperEnvelopeLog(x, support)).toBeGreaterThanOrEqual(logTarget(x) - 1e-9);
            if (x >= support[0] && x <= support[support.length - 1]) {
                expect(lowerEnvelopeLog(x, support)).toBeLessThanOrEqual(logTarget(x) + 1e-9);
            }
        }
    });

    it("accepts draws with an exponential envelope and tightens the support", () => {
        const input = mod.defaultInput as { samples: number; seed: number; initialSupport: number[] };
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(Number(final?.meta["sampleCount"])).toBe(input.samples);
        expect(Number(final?.meta["acceptanceRate"])).toBeGreaterThan(0.5);
        expect((final?.meta["support"] as number[]).length).toBeGreaterThanOrEqual(input.initialSupport.length);
        const samples = final?.meta["samples"] as number[];
        expect(samples.length).toBe(input.samples);
        expect(samples.every((x) => Number.isFinite(x))).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("recovers the standard normal mean and variance", () => {
        const frames = [...mod.run({ samples: 6000, seed: 5, initialSupport: [-2, 0, 2] })];
        const final = frames[frames.length - 1];
        const mean = Number(final?.meta["mean"]);
        const variance = Number(final?.meta["variance"]);
        expect(Number.isFinite(mean)).toBe(true);
        expect(Math.abs(mean)).toBeLessThan(0.15);
        expect(Math.abs(variance - 1)).toBeLessThan(0.25);
    });
});
