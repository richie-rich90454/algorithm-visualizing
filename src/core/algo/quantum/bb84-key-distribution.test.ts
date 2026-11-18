/**
 * bb84-key-distribution.test.ts - Sifting reference, error statistics, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bb84-key-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rounds);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(rounds);
    });
}

function finalMeta(rounds: number, seed: number, eavesdropper: boolean, sampleFraction = 0.25) {
    const frames = [...mod.run({ rounds, seed, eavesdropper, sampleFraction })];
    checkFrames(frames, rounds);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("BB84 key distribution (toy)", () => {
    it("sifts only matching-basis rounds and agrees without an eavesdropper", () => {
        for (const seed of [1, 2, 3, 7, 11, 42, 100]) {
            const rounds = 24;
            const meta = finalMeta(rounds, seed, false, 0.25);
            const basesA = meta["aliceBases"] as number[];
            const basesB = meta["bobBases"] as number[];
            const bitsA = meta["aliceBits"] as number[];
            const bitsB = meta["bobBits"] as number[];
            const kept: number[] = [];
            for (let i = 0; i < rounds; i += 1) {
                if (basesA[i] === basesB[i]) {
                    kept.push(i);
                    expect(bitsA[i]).toBe(bitsB[i]);
                }
            }
            expect(meta["keptIndices"]).toEqual(kept);
            const sample = meta["sampleIndices"] as number[];
            const keyIndices = meta["keyIndices"] as number[];
            expect(keyIndices.length + sample.length).toBe(kept.length);
            expect(meta["keyLength"]).toBe(keyIndices.length);
            const expectedKey = keyIndices.map((i) => bitsA[i]).join("");
            expect(meta["key"]).toBe(expectedKey);
            expect(meta["keysMatch"]).toBe(true);
            expect(Number(meta["errorRate"])).toBe(0);
        }
    });

    it("an intercept-and-resend eavesdropper raises the sample error", () => {
        let totalMismatch = 0;
        let totalKept = 0;
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const rounds = 64;
            const meta = finalMeta(rounds, seed, true, 0.5);
            const sample = meta["sampleIndices"] as number[];
            const basesA = meta["aliceBases"] as number[];
            const basesB = meta["bobBases"] as number[];
            const bitsA = meta["aliceBits"] as number[];
            const bitsB = meta["bobBits"] as number[];
            let mismatch = 0;
            for (const i of sample) {
                if (bitsA[i] !== bitsB[i]) {
                    mismatch += 1;
                }
            }
            totalMismatch += mismatch;
            totalKept += sample.length;
            expect(Number(meta["errorRate"])).toBeCloseTo(mismatch / sample.length, 12);
            expect(Number(meta["mismatches"])).toBe(mismatch);
            for (const i of sample) {
                expect(basesA[i]).toBe(basesB[i]);
            }
        }
        // Intercept-and-resend produces roughly one-quarter disagreement on sifted bits.
        expect(totalMismatch / totalKept).toBeGreaterThan(0.12);
        expect(totalMismatch / totalKept).toBeLessThan(0.38);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
