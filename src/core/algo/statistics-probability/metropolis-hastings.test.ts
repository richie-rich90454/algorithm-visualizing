/**
 * metropolis-hastings.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./metropolis-hastings";
import type { VisualFrame } from "@/types";

/** Independent copy of the seeded mulberry32 generator. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Independent reference chain using the standard Metropolis acceptance rule. */
function reference(steps: number, width: number, seed: number) {
    const rng = makeRng(seed);
    const f = (x: number) => Math.exp((-x * x) / 2);
    let current = 0;
    let density = f(current);
    let acceptedCount = 0;
    let sum = 0;
    const values: number[] = [current];
    for (let i = 1; i <= steps; i += 1) {
        const proposal = current + (2 * rng() - 1) * width;
        const proposalDensity = f(proposal);
        const ratio = proposalDensity / density;
        const uniform = rng();
        if (uniform < Math.min(1, ratio)) {
            current = proposal;
            density = proposalDensity;
            acceptedCount += 1;
        }
        values.push(current);
        sum += current;
    }
    return { values, acceptedCount, mean: sum / values.length };
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        // One more sample appears on each iteration frame; the final frame repeats the chain.
        const expectedNodes = index <= steps ? index + 1 : steps + 1;
        expect(frame.entities.length).toBe(expectedNodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Metropolis-Hastings", () => {
    it("replicates an independent reference chain exactly", () => {
        const input = { steps: 150, step: 1.2, seed: 7 };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.steps);
        const expected = reference(input.steps, input.step, input.seed);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["accepted"]).toBe(expected.acceptedCount);
        expect(meta?.["mean"] as number).toBeCloseTo(expected.mean, 12);
        expect(meta?.["acceptanceRate"] as number).toBeCloseTo(expected.acceptedCount / input.steps, 12);

        const samples = frames[input.steps + 1]?.entities ?? [];
        expect(samples.length).toBe(expected.values.length);
        for (let i = 0; i < expected.values.length; i += 1) {
            expect(samples[i]?.value as number).toBeCloseTo(expected.values[i] as number, 12);
        }
    });

    it("samples near the standard normal center over a long chain", () => {
        const frames = [...mod.run({ steps: 1500, step: 1, seed: 123 })];
        const mean = frames[frames.length - 1]?.meta["mean"] as number;
        expect(Math.abs(mean)).toBeLessThan(0.15);
    });

    it("keeps acceptance bounded between zero and one", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const rate = frame.meta["acceptanceRate"] as number;
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
