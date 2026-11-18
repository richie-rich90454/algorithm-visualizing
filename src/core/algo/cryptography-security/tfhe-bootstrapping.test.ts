/**
 * tfhe-bootstrapping.test.ts - Independent LWE phase, decode, and noise-refresh
 * reference, frame shape, and termination checks. Tests a toy model.
 */

import { describe, expect, it } from "vitest";
import mod from "./tfhe-bootstrapping";
import type { VisualFrame } from "@/types";

const Q = 256;
const HALF = 128;
const A = [7, -5];
const S = [3, -2];
const BOUND = 2;

function smallNoise(seed: number, offset: number): number[] {
    let state = (seed + offset) >>> 0;
    return A.map(() => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (state % (2 * BOUND + 1)) - BOUND;
    });
}

function inner(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
}

function modq(v: number): number {
    return ((v % Q) + Q) % Q;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(12);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(6);
        expect(frame.meta["cols"]).toBe(2);
    });
}

describe("TfheBootstrappingToy", () => {
    it("reproduces independent phases and the refreshed bit for both messages", () => {
        for (const bit of [0, 1]) {
            for (const seed of [11, 4, 77]) {
                const frames = [...mod.run({ bit, seed })];
                checkFrames(frames);
                const final = frames[frames.length - 1];
                const as = inner(A, S);
                const noise = smallNoise(seed, 0);
                const phase = modq(as + inner(noise, [1, 1]) + bit * HALF);
                const fresh = smallNoise(seed, 1000);
                const refreshedPhase = modq(as + inner(fresh, [1, 1]) + (phase > HALF ? 1 : 0) * HALF);
                expect(Number(final?.meta["as"])).toBe(as);
                expect(final?.meta["noise"]).toEqual(noise);
                expect(Number(final?.meta["lwePhase"])).toBe(phase);
                expect(final?.meta["freshNoise"]).toEqual(fresh);
                expect(Number(final?.meta["refreshedPhase"])).toBe(refreshedPhase);
                expect(Number(final?.meta["decoded"])).toBe(bit);
                expect(Number(final?.meta["refreshedBit"])).toBe(bit);
                expect(final?.meta["valid"]).toBe(true);
            }
        }
    });

    it("keeps the fresh noise within the bound and on the correct side of the midpoint", () => {
        for (const bit of [0, 1]) {
            const frames = [...mod.run({ bit, seed: 5 })];
            const final = frames[frames.length - 1];
            const fresh = final?.meta["freshNoise"] as number[];
            fresh.forEach((v) => {
                expect(Math.abs(v)).toBeLessThanOrEqual(BOUND);
            });
            const refreshed = Number(final?.meta["refreshedPhase"]);
            expect(refreshed > HALF ? 1 : 0).toBe(bit);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
