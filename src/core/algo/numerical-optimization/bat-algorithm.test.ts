/**
 * bat-algorithm.test.ts - Independent generation replay, monotonic best,
 * convergence against brute-force sampling, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bat-algorithm";
import type { VisualFrame } from "@/types";

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function objective(x: number[]): number {
    return x.reduce((sum, value) => sum + value * value, 0);
}

interface Params {
    dimension: number;
    population: number;
    frequencyMin: number;
    frequencyMax: number;
    loudness: number;
    pulse: number;
    lower: number;
    upper: number;
    seed: number;
}

/** Independent replay of one bat generation. */
function referenceGeneration(p: Params): number[][] {
    const random = makeRandom(p.seed);
    const positions = Array.from({ length: p.population }, () =>
        Array.from({ length: p.dimension }, () => p.lower + random() * (p.upper - p.lower)),
    );
    const velocities = Array.from({ length: p.population }, () => new Array<number>(p.dimension).fill(0));
    const loudness = new Array<number>(p.population).fill(p.loudness);
    const pulse = new Array<number>(p.population).fill(p.pulse);
    const values = positions.map(objective);
    let bestIndex = values.indexOf(Math.min(...values));
    const best = [...positions[bestIndex]!];
    const meanLoudness = loudness.reduce((sum, value) => sum + value, 0) / p.population;
    for (let i = 0; i < p.population; i += 1) {
        const frequency = p.frequencyMin + (p.frequencyMax - p.frequencyMin) * random();
        const candidate = new Array<number>(p.dimension).fill(0);
        for (let k = 0; k < p.dimension; k += 1) {
            const velocity = velocities[i]![k]! + (positions[i]![k]! - best[k]!) * frequency;
            velocities[i]![k] = velocity;
            candidate[k] = positions[i]![k]! + velocity;
        }
        if (random() > pulse[i]!) {
            for (let k = 0; k < p.dimension; k += 1) {
                candidate[k] = best[k]! + (random() * 2 - 1) * meanLoudness;
            }
        }
        for (let k = 0; k < p.dimension; k += 1) {
            candidate[k] = Math.max(p.lower, Math.min(p.upper, candidate[k]!));
        }
        const value = objective(candidate);
        if (random() < loudness[i]! && value < values[i]!) {
            positions[i] = candidate;
            loudness[i] = loudness[i]! * 0.95;
            pulse[i] = Math.min(1, pulse[i]! * 1.05);
            if (value < objective(best)) best.splice(0, best.length, ...candidate);
        }
    }
    return positions;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("bat algorithm", () => {
    const input = mod.defaultInput as Params;

    it("replicates one generation exactly", () => {
        const frames = [...mod.run({ ...input, generations: 1 })];
        checkFrames(frames, input.dimension);
        const actual = frames[1]!.meta["populationFlat"] as number[];
        const expected = referenceGeneration(input).flat();
        expect(actual.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(actual[i]).toBeCloseTo(expected[i]!, 10);
        }
    });

    it("never worsens the best objective and stays in bounds", () => {
        const frames = [...mod.run({ ...input, generations: 60 })];
        let previous = Infinity;
        for (const frame of frames) {
            const value = Number(frame.meta["bestValue"]);
            expect(value).toBeLessThanOrEqual(previous + 1e-12);
            previous = value;
            for (const coordinate of frame.meta["populationFlat"] as number[]) {
                expect(coordinate).toBeGreaterThanOrEqual(input.lower - 1e-12);
                expect(coordinate).toBeLessThanOrEqual(input.upper + 1e-12);
            }
        }
    });

    it("finds a better optimum than brute-force sampling", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.dimension);
        const bestValue = Number(frames[frames.length - 1]!.meta["bestValue"]);
        expect(bestValue).toBeLessThan(0.05);
        const random = makeRandom(999);
        let sampled = Infinity;
        for (let i = 0; i < 20000; i += 1) {
            const point = Array.from({ length: input.dimension }, () => input.lower + random() * (input.upper - input.lower));
            sampled = Math.min(sampled, objective(point));
        }
        expect(bestValue).toBeLessThanOrEqual(sampled + 1e-12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
