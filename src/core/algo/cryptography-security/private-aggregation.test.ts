/** private-aggregation.test.ts - Independent mask replay, aggregate identity, privacy check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./private-aggregation";
import type { VisualFrame } from "@/types";

interface AggregationInput { values: number[]; seed: number; mod: number; }

function reference(values: number[], seed: number, mod: number) {
    let rng = seed >>> 0 || 1;
    const masked = values.map(() => 0);
    const masks: number[] = [];
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            rng = (Math.imul(1103515245, rng) + 12345) >>> 1;
            const mask = rng % mod;
            masks.push(mask);
            masked[i] = (masked[i] + mask) % mod;
            masked[j] = ((masked[j] - mask) % mod + mod) % mod;
        }
    }
    const sent = masked.map((m, i) => ((m + values[i]) % mod + mod) % mod);
    return { masked: sent, masks, aggregate: sent.reduce((s, m) => (s + m) % mod, 0) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Secure Aggregation by Masking", () => {
    it("matches an independent mask replay on the default input", () => {
        const input = mod.defaultInput as AggregationInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.values, input.seed, input.mod);
        expect(final?.["masks"]).toEqual(expected.masks);
        expect(final?.["masked"]).toEqual(expected.masked);
        expect(final?.["aggregate"]).toBe(expected.aggregate);
        expect(final?.["correct"]).toBe(true);
    });

    it("the aggregate equals the plain sum modulo the modulus on random inputs", () => {
        let state = 4321;
        const next = () => { state = (Math.imul(1103515245, state) + 12345) >>> 1; return state; };
        for (let trial = 0; trial < 30; trial += 1) {
            const values = Array.from({ length: 2 + (trial % 5) }, () => next() % 100);
            const seed = (next() >>> 1) || 1;
            const modulus = 256;
            const final = [...mod.run({ values, seed, mod: modulus })].at(-1)?.meta;
            expect(final?.["aggregate"]).toBe(values.reduce((s, v) => s + v, 0) % modulus);
        }
    });

    it("masks cancel even though individual sent values differ from the truth", () => {
        const input = { values: [12, 7, 20, 5], seed: 13, mod: 256 };
        const final = [...mod.run(input)].at(-1)?.meta;
        const sent = final?.["masked"] as number[];
        expect(sent.some((value, i) => value !== input.values[i])).toBe(true);
        expect(final?.["aggregate"]).toBe(input.values.reduce((s, v) => s + v, 0));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
