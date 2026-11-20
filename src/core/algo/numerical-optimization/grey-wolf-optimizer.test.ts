/**
 * grey-wolf-optimizer.test.ts - Independent generation replay, monotonic best,
 * comparison with brute-force sampling, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./grey-wolf-optimizer";
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
    lower: number;
    upper: number;
    seed: number;
}

/** Independent replay of one grey wolf generation. */
function referenceGeneration(p: Params): number[][] {
    const random = makeRandom(p.seed);
    const positions = Array.from({ length: p.population }, () =>
        Array.from({ length: p.dimension }, () => p.lower + random() * (p.upper - p.lower)),
    );
    const values = positions.map(objective);
    const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const alpha = positions[order[0]!.index]!;
    const beta = positions[order[1]!.index]!;
    const delta = positions[order[2]!.index]!;
    const coefficient = 2;
    for (let i = 0; i < p.population; i += 1) {
        const candidate = new Array<number>(p.dimension).fill(0);
        for (let k = 0; k < p.dimension; k += 1) {
            let coordinate = 0;
            for (const leader of [alpha, beta, delta]) {
                const a1 = 2 * coefficient * random() - coefficient;
                const c1 = 2 * random();
                const distance = Math.abs(c1 * leader[k]! - positions[i]![k]!);
                coordinate += leader[k]! - a1 * distance;
            }
            candidate[k] = Math.max(p.lower, Math.min(p.upper, coordinate / 3));
        }
        positions[i] = candidate;
        values[i] = objective(candidate);
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

describe("grey wolf optimizer", () => {
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
