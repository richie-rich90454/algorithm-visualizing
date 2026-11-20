/**
 * differential-evolution.test.ts - Replicated generation mechanics, monotonic
 * best, brute-force sampling comparison, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./differential-evolution";
import type { VisualFrame } from "@/types";

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function sphere(x: number[]): number {
    return x.reduce((sum, v) => sum + v * v, 0);
}

interface Params {
    dimension: number;
    population: number;
    scale: number;
    crossover: number;
    lower: number;
    upper: number;
    seed: number;
}

/** Independent replay of initialization plus one DE/rand/1/bin generation. */
function referenceOneGeneration(p: Params): number[][] {
    const random = makeRandom(p.seed);
    let population = Array.from({ length: p.population }, () =>
        Array.from({ length: p.dimension }, () => p.lower + random() * (p.upper - p.lower)),
    );
    const values = population.map(sphere);
    const next = population.map((row) => [...row]);
    const nextValues = [...values];
    for (let i = 0; i < p.population; i += 1) {
        let r1 = Math.floor(random() * p.population);
        while (r1 === i) r1 = Math.floor(random() * p.population);
        let r2 = Math.floor(random() * p.population);
        while (r2 === i || r2 === r1) r2 = Math.floor(random() * p.population);
        let r3 = Math.floor(random() * p.population);
        while (r3 === i || r3 === r1 || r3 === r2) r3 = Math.floor(random() * p.population);
        const jrand = Math.floor(random() * p.dimension);
        const trial = Array.from({ length: p.dimension }, (_, j) => {
            const donor = population[r1]![j]! + p.scale * (population[r2]![j]! - population[r3]![j]!);
            return j === jrand || random() < p.crossover ? donor : population[i]![j]!;
        });
        const clamped = trial.map((v) => Math.max(p.lower, Math.min(p.upper, v)));
        const value = sphere(clamped);
        if (value <= values[i]!) {
            next[i] = clamped;
            nextValues[i] = value;
        }
    }
    population = next;
    void nextValues;
    return population;
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

describe("differential evolution", () => {
    const input = mod.defaultInput as Params & { generations: number };

    it("replicates one generation exactly", () => {
        const frames = [...mod.run({ ...input, generations: 1 })];
        checkFrames(frames, input.dimension);
        const afterOne = frames[1]!.meta["populationFlat"] as number[];
        const expected = referenceOneGeneration(input).flat();
        expect(afterOne.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(afterOne[i]).toBeCloseTo(expected[i]!, 10);
        }
    });

    it("never worsens the best objective", () => {
        const frames = [...mod.run({ ...input, generations: 60 })];
        let previous = Infinity;
        for (const frame of frames) {
            const value = Number(frame.meta["bestValue"]);
            expect(value).toBeLessThanOrEqual(previous + 1e-12);
            previous = value;
        }
    });

    it("converges and beats brute-force random sampling", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.dimension);
        const final = frames[frames.length - 1]?.meta;
        const bestValue = Number(final?.["bestValue"]);
        expect(bestValue).toBeLessThan(1e-3);

        const random = makeRandom(999);
        let sampleBest = Infinity;
        for (let i = 0; i < 20000; i += 1) {
            const point = Array.from({ length: input.dimension }, () => input.lower + random() * (input.upper - input.lower));
            sampleBest = Math.min(sampleBest, sphere(point));
        }
        expect(bestValue).toBeLessThanOrEqual(sampleBest + 1e-9);
    });

    it("keeps every coordinate within bounds", () => {
        const frames = [...mod.run({ ...input, generations: 30 })];
        for (const frame of frames) {
            const population = frame.meta["populationFlat"] as number[];
            for (const value of population) {
                expect(value).toBeGreaterThanOrEqual(input.lower - 1e-12);
                expect(value).toBeLessThanOrEqual(input.upper + 1e-12);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
