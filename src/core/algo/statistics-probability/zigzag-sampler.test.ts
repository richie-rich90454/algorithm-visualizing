/**
 * zigzag-sampler.test.ts - Independent replay, property, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { makeRng, zigzagRate } from "./zigzag-sampler";
import type { VisualFrame } from "@/types";

/** Independent reconstruction of the trajectory from scratch. */
function reference(input: { steps: number; refresh: number; seed: number; x0: number; v0: number }) {
    const rng = makeRng(input.seed);
    let x = input.x0;
    let velocity = input.v0;
    const trace: Array<[number, number]> = [[x, velocity]];
    let weightedSum = 0;
    let elapsed = 0;
    for (let i = 0; i < input.steps; i += 1) {
        const rate = Math.max(0, velocity * x) + input.refresh;
        const tau = -Math.log(Math.max(rng(), 1e-12)) / rate;
        weightedSum += (x + (velocity * tau) / 2) * tau;
        elapsed += tau;
        x += velocity * tau;
        velocity = -velocity;
        trace.push([x, velocity]);
    }
    return { x, velocity, trace, weightedMean: weightedSum / elapsed, elapsed };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["trace"])).toBe(true);
    });
}

describe("Zig-Zag sampler", () => {
    it("computes the bounce rate from the normal potential", () => {
        expect(zigzagRate(2, 1, 0.5)).toBeCloseTo(2.5, 10);
        expect(zigzagRate(2, -1, 0.5)).toBeCloseTo(0.5, 10);
        expect(zigzagRate(-3, -1, 0.25)).toBeCloseTo(3.25, 10);
        expect(zigzagRate(-3, 1, 0.25)).toBeCloseTo(0.25, 10);
    });

    it("matches an independent event-by-event replay", () => {
        const input = mod.defaultInput as { steps: number; refresh: number; seed: number; x0: number; v0: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1];
        expect(final?.meta["x"] ?? final?.meta["finalPosition"]).toBe(expected.x);
        expect(final?.meta["velocity"]).toBe(expected.velocity);
        expect(final?.meta["elapsed"]).toBe(expected.elapsed);
        expect(final?.meta["weightedMean"]).toBe(expected.weightedMean);
        const trace = final?.meta["trace"] as Array<[number, number]>;
        expect(trace.length).toBe(expected.trace.length);
        for (let i = 0; i < trace.length; i += 1) {
            expect(trace[i]?.[0]).toBe(expected.trace[i]?.[0]);
            expect(trace[i]?.[1]).toBe(expected.trace[i]?.[1]);
        }
    });

    it("approaches the standard normal mean over a long deterministic run", () => {
        const frames = [...mod.run({ steps: 4000, refresh: 0.7, seed: 11, x0: 3, v0: 1 })];
        const mean = Number(frames[frames.length - 1]?.meta["weightedMean"]);
        expect(Number.isFinite(mean)).toBe(true);
        expect(Math.abs(mean)).toBeLessThan(0.3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run({ steps: 5, seed: 3 });
        const frames = [...generator];
        expect(frames.length).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
