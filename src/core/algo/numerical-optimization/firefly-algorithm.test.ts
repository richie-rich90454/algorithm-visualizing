/**
 * firefly-algorithm.test.ts - Independent generation replay, monotonic best,
 * convergence against brute-force sampling, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./firefly-algorithm";
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
    alpha: number;
    beta: number;
    gamma: number;
    lower: number;
    upper: number;
    seed: number;
}

/** Independent replay of one firefly generation. */
function referenceGeneration(p: Params): number[][] {
    const random = makeRandom(p.seed);
    const positions = Array.from({ length: p.population }, () =>
        Array.from({ length: p.dimension }, () => p.lower + random() * (p.upper - p.lower)),
    );
    const values = positions.map(objective);
    const walk = p.alpha;
    for (let i = 0; i < p.population; i += 1) {
        for (let j = 0; j < p.population; j += 1) {
            if (values[j]! >= values[i]!) continue;
            let distance = 0;
            for (let k = 0; k < p.dimension; k += 1) {
                const delta = positions[i]![k]! - positions[j]![k]!;
                distance += delta * delta;
            }
            const attraction = p.beta * Math.exp(-p.gamma * distance);
            for (let k = 0; k < p.dimension; k += 1) {
                const current = positions[i]![k]!;
                const target = positions[j]![k]!;
                positions[i]![k] = Math.max(p.lower, Math.min(p.upper,
                    current + attraction * (target - current) + walk * (random() - 0.5)));
            }
        }
        values[i] = objective(positions[i]!);
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

describe("firefly algorithm", () => {
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
