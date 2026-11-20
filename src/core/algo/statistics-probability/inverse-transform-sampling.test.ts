/**
 * inverse-transform-sampling.test.ts - Reproducible reference draws,
 * distribution and monotonicity properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./inverse-transform-sampling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], outcomes: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(outcomes);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cdf"]).toBeDefined();
    });
}

/** Independent LCG plus a linear scan of the CDF. */
function referenceDraws(values: number[], probabilities: number[], n: number, seedInput: number): number[] {
    const cdf: number[] = [];
    let total = 0;
    for (const p of probabilities) {
        total += p;
        cdf.push(total);
    }
    cdf[cdf.length - 1] = 1;
    let state = seedInput >>> 0;
    const draws: number[] = [];
    for (let i = 0; i < n; i += 1) {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        const u = state / 4294967296;
        let index = 0;
        while (index < cdf.length - 1 && u >= cdf[index]!) {
            index += 1;
        }
        draws.push(values[index]!);
    }
    return draws;
}

describe("InverseTransformSampling", () => {
    it("matches an independent uniform stream and linear CDF scan exactly", () => {
        const input = mod.defaultInput as {
            values: number[];
            probabilities: number[];
            samples: number;
            seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const draws = frames[frames.length - 1]!.meta["draws"] as number[];
        expect(draws).toEqual(referenceDraws(input.values, input.probabilities, input.samples, input.seed));
    });

    it("approaches the target probabilities over a large sample", () => {
        const input = { values: [0, 1, 2], probabilities: [0.2, 0.3, 0.5], samples: 4000, seed: 7 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);
        const frequencies = frames[frames.length - 1]!.meta["frequencies"] as number[];
        for (let i = 0; i < input.probabilities.length; i += 1) {
            expect(Math.abs(frequencies[i]! - input.probabilities[i]!)).toBeLessThan(0.03);
        }
    });

    it("maps ordered uniforms to non-decreasing outcomes", () => {
        const frames = [...mod.run({ values: [10, 20, 30, 40], probabilities: [0.1, 0.2, 0.3, 0.4], samples: 200, seed: 99 })];
        checkFrames(frames, 4);
        const meta = frames[frames.length - 1]!.meta;
        const uniforms = meta["uniforms"] as number[];
        const valuesByIndex = new Map((meta["values"] as number[]).map((v, i) => [i, v]));
        const draws = meta["draws"] as number[];
        const ordered = uniforms.map((u, i) => [u, draws[i]!] as const).sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < ordered.length; i += 1) {
            expect(ordered[i]![1]).toBeGreaterThanOrEqual(ordered[i - 1]![1]);
        }
        expect(valuesByIndex.size).toBe(4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(22);
        expect(generator.next().done).toBe(true);
    });
});
