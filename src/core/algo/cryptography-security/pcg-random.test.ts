/** pcg-random.test.ts - BigInt reference, published output vectors, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./pcg-random";
import type { VisualFrame } from "@/types";

const MASK64 = (1n << 64n) - 1n;
const MULT = 6364136223846793005n;

function reference(seed: number, increment: number, draws: number): number[] {
    let state = BigInt(seed);
    const inc = ((BigInt(increment) << 1n) | 1n) & MASK64;
    const out: number[] = [];
    for (let i = 0; i < draws; i += 1) {
        state = (state * MULT + inc) & MASK64;
        const x = ((state >> 18n) ^ state) >> 27n;
        const r = Number(state >> 59n);
        const rotated = ((x >> BigInt(r)) | (x << BigInt((-r) & 31))) & 0xffffffffn;
        out.push(Number(rotated));
    }
    return out;
}

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("pcg-random", () => {
    it("matches an independent BigInt PCG32 implementation", () => {
        const input = mod.defaultInput as { seed: number; increment: number; draws: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.draws);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["outputs"]).toEqual(reference(input.seed, input.increment, input.draws));
    });

    it("reproduces known PCG32 output vectors", () => {
        const frames = [...mod.run({ seed: 42, increment: 54, draws: 5 })];
        const outputs = frames[frames.length - 1]?.meta["outputs"] as number[];
        expect(outputs).toEqual([211770500, 199114405, 1239240681, 2463923067, 2219633437]);
    });

    it("is deterministic and emits only 32-bit values", () => {
        const a = [...mod.run({ seed: 7, increment: 10, draws: 12 })];
        const b = [...mod.run({ seed: 7, increment: 10, draws: 12 })];
        expect(a[a.length - 1]?.meta["outputs"]).toEqual(b[b.length - 1]?.meta["outputs"]);
        const outputs = a[a.length - 1]?.meta["outputs"] as number[];
        for (const value of outputs) {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(0xffffffff);
        }
        const differentSeed = [...mod.run({ seed: 8, increment: 10, draws: 12 })];
        expect(differentSeed[differentSeed.length - 1]?.meta["outputs"]).not.toEqual(
            a[a.length - 1]?.meta["outputs"],
        );
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
