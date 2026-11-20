/**
 * grover-rudolph.test.ts - Prepared-distribution correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./grover-rudolph";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    }
}

function normalize(input: number[]): number[] {
    const clean = input.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
    const total = clean.reduce((a, b) => a + b, 0);
    return total > 0 ? clean.map((x) => x / total) : clean.map(() => 1 / clean.length);
}

describe("Grover-Rudolph State Preparation", () => {
    it("prepares the default target distribution exactly", () => {
        const input = mod.defaultInput as { probs: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = normalize(input.probs);
        const prepared = final?.["prepared"] as number[];
        expect(prepared.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(prepared[i]).toBeCloseTo(expected[i], 9);
        }
        expect(final?.["norm"]).toBeCloseTo(1, 9);
        expect(final?.["error"]).toBeLessThan(1e-9);
    });

    it("prepares random distributions over four and eight outcomes", () => {
        let seed = 73;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (const size of [4, 8]) {
            for (let trial = 0; trial < 12; trial += 1) {
                const probs = Array.from({ length: size }, () => rand());
                const frames = [...mod.run({ probs })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                const expected = normalize(probs);
                const prepared = final?.["prepared"] as number[];
                for (let i = 0; i < size; i += 1) {
                    expect(prepared[i]).toBeCloseTo(expected[i], 9);
                }
                expect(prepared.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
            }
        }
    });

    it("handles zero-probability outcomes", () => {
        const probs = [0, 0.5, 0.5, 0];
        const frames = [...mod.run({ probs })];
        checkFrames(frames);
        const prepared = frames[frames.length - 1]?.meta["prepared"] as number[];
        for (let i = 0; i < prepared.length; i += 1) {
            expect(prepared[i]).toBeCloseTo([0, 0.5, 0.5, 0][i] ?? 0, 9);
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
