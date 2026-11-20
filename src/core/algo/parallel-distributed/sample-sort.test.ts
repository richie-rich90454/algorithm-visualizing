/**
 * sample-sort.test.ts - Sorted-order and permutation properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sample-sort";
import type { VisualFrame } from "@/types";

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(frame.meta["cols"]);
        expect(frame.entities.length).toBe((frame.meta["rows"] as number) ** 2);
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.edges).toEqual([]);
    });
}

describe("SampleSort", () => {
    it("returns a sorted permutation of the input", () => {
        const rand = rng(777);
        const cases: number[][] = [
            (mod.defaultInput as { values: number[] }).values,
            [5, 5, 5, 5],
            [9, -3, 0, 7, 7, -10, 2],
            Array.from({ length: 40 }, () => Math.floor(rand() * 100) - 50),
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values, processors: 4, samplesPerBlock: 2 })];
            checkFrames(frames);
            const result = frames.at(-1)!.meta["final"] as number[];
            expect(result.length).toBe(values.length);
            expect([...result].sort((a, b) => a - b)).toEqual([...values].sort((a, b) => a - b));
            expect(result.every((v, i) => i === 0 || result[i - 1]! <= v)).toBe(true);
        }
    });

    it("splitters are nondecreasing and every value lands in one bucket", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const splitters = frames[2]!.meta["splitters"] as number[];
        expect(splitters.every((v, i) => i === 0 || splitters[i - 1]! <= v)).toBe(true);
        const total = frames.at(-1)!.entities.reduce((s, e) => s + (e.value as number), 0);
        expect(total).toBe((mod.defaultInput as { values: number[] }).values.length);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        const p = 4;
        expect(count).toBe(1 + 2 + p + p + 1);
        expect(gen.next().done).toBe(true);
    });
});
