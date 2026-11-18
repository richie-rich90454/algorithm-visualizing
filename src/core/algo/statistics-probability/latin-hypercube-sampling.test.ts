/**
 * latin-hypercube-sampling.test.ts - Stratum property, determinism, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./latin-hypercube-sampling";
import type { VisualFrame } from "@/types";

function chunk(flat: number[], size: number): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < flat.length; i += size) result.push(flat.slice(i, i + size));
    return result;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(Number(frame.meta["revealed"]));
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Latin Hypercube Sampling", () => {
    it("places exactly one coordinate per stratum in every dimension", () => {
        for (const input of [
            { samples: 8, dimensions: 2, seed: 1 },
            { samples: 5, dimensions: 3, seed: 42 },
            { samples: 11, dimensions: 1, seed: 7 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.samples);
            const final = frames[frames.length - 1];
            const points = chunk(final?.meta["pointsFlat"] as number[], input.dimensions);
            expect(points.length).toBe(input.samples);
            for (let d = 0; d < input.dimensions; d += 1) {
                const column = points.map((p) => p[d] as number);
                expect(column.every((v) => v >= 0 && v < 1)).toBe(true);
                const strata = column.map((v) => Math.min(input.samples - 1, Math.floor(v * input.samples))).sort((a, b) => a - b);
                expect(strata).toEqual(Array.from({ length: input.samples }, (_, i) => i));

                const perm = chunk(final?.meta["permutationsFlat"] as number[], input.samples);
                expect([...((perm[d] as number[]))].sort((a, b) => a - b)).toEqual(
                    Array.from({ length: input.samples }, (_, i) => i),
                );
            }
        }
    });

    it("is deterministic for a fixed seed and varies with the seed", () => {
        const a = [...mod.run({ samples: 10, dimensions: 2, seed: 123 })];
        const b = [...mod.run({ samples: 10, dimensions: 2, seed: 123 })];
        const c = [...mod.run({ samples: 10, dimensions: 2, seed: 124 })];
        expect(a[a.length - 1]?.meta["pointsFlat"]).toEqual(b[b.length - 1]?.meta["pointsFlat"]);
        expect(a[a.length - 1]?.meta["pointsFlat"]).not.toEqual(c[c.length - 1]?.meta["pointsFlat"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
