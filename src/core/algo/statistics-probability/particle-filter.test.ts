/**
 * particle-filter.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./particle-filter";
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

type Input = {
    particles: number;
    observations: number[];
    processNoise: number;
    obsVar: number;
    seed: number;
};

/** Reference SIR particle filter. */
function reference(input: Input) {
    const rng = makeRng(input.seed);
    const n = input.particles;
    let positions = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : -2 + (4 * i) / (n - 1)));
    const records: Array<{ estimate: number; ess: number }> = [];

    for (const observation of input.observations) {
        for (let i = 0; i < n; i += 1) {
            positions[i] = (positions[i] as number) + (2 * rng() - 1) * input.processNoise;
        }
        const raw = positions.map((p) => Math.exp(-((observation - p) ** 2) / (2 * input.obsVar)));
        const total = raw.reduce((a, b) => a + b, 0);
        const weights = raw.map((l) => l / total);
        const estimate = positions.reduce((acc, p, i) => acc + p * (weights[i] as number), 0);
        const ess = 1 / weights.reduce((acc, w) => acc + w * w, 0);
        const cumulative: number[] = [];
        let running = 0;
        for (let i = 0; i < n; i += 1) {
            running += weights[i] as number;
            cumulative.push(running);
        }
        const resampled: number[] = [];
        for (let i = 0; i < n; i += 1) {
            const u = rng();
            let chosen = n - 1;
            for (let j = 0; j < n; j += 1) {
                if (u <= (cumulative[j] as number)) {
                    chosen = j;
                    break;
                }
            }
            resampled.push(positions[chosen] as number);
        }
        positions = resampled;
        records.push({ estimate, ess });
    }
    return { records, positions };
}

function checkFrames(frames: VisualFrame[], n: number, steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Particle Filter", () => {
    it("replicates an independent SIR filter exactly", () => {
        const input: Input = {
            particles: 24,
            observations: [0.4, 1.1, -0.3, 1.7, 0.9, 0.2],
            processNoise: 0.6,
            obsVar: 0.4,
            seed: 11,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.particles, input.observations.length);
        const expected = reference(input);

        for (let t = 0; t < expected.records.length; t += 1) {
            const meta = frames[t + 1]?.meta;
            expect(meta?.["estimate"] as number).toBeCloseTo(expected.records[t]?.estimate as number, 12);
            expect(meta?.["ess"] as number).toBeCloseTo(expected.records[t]?.ess as number, 12);
        }
        const finalPositions = frames[frames.length - 1]?.entities.map((e) => e.value as number) ?? [];
        for (let i = 0; i < expected.positions.length; i += 1) {
            expect(finalPositions[i]).toBeCloseTo(expected.positions[i] as number, 12);
        }
    });

    it("keeps estimates finite and effective sample size in range", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const ess = frame.meta["ess"] as number;
            const estimate = frame.meta["estimate"] as number;
            expect(Number.isFinite(estimate)).toBe(true);
            expect(ess).toBeGreaterThanOrEqual(0.999);
            expect(ess).toBeLessThanOrEqual(20 + 1e-9);
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
