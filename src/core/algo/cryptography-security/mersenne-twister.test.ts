/**
 * mersenne-twister.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { createMt19937, mt19937Sequence } from "./mersenne-twister";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeLessThanOrEqual(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mersenne Twister MT19937", () => {
    it("reproduces the canonical seed-5489 test vector", () => {
        const expected = [
            3499211612, 581869302, 3890346734, 3586334585, 545404204,
            4161255391, 3922919429, 949333985, 2715962298, 1323567403,
        ];
        expect(mt19937Sequence(5489, expected.length)).toEqual(expected);
    });

    it("is deterministic per seed, diverges across seeds, and spans 32 bits", () => {
        expect(mt19937Sequence(123, 20)).toEqual(mt19937Sequence(123, 20));
        expect(mt19937Sequence(123, 20)).not.toEqual(mt19937Sequence(124, 20));
        const words = mt19937Sequence(42, 2000);
        for (const word of words) {
            expect(Number.isInteger(word)).toBe(true);
            expect(word).toBeGreaterThanOrEqual(0);
            expect(word).toBeLessThanOrEqual(0xffffffff);
        }
    });

    it("crosses the 624-word twist boundary", () => {
        const rng = createMt19937(1);
        const a: number[] = [];
        for (let i = 0; i < 1300; i += 1) a.push(rng.next());
        const reference = mt19937Sequence(1, 1300);
        expect(a).toEqual(reference);
        expect(new Set(a.slice(0, 624)).size).toBeGreaterThan(600);
    });

    it("emits well-formed frames with a final meta that matches the stream", () => {
        const input = mod.defaultInput as { seed: number; count: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.count);
        expect(frames.length).toBe(input.count + 2);
        expect(frames[frames.length - 1]!.meta["outputs"]).toEqual(
            mt19937Sequence(input.seed, input.count),
        );
        expect(frames[frames.length - 1]!.meta["generated"]).toBe(input.count);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
