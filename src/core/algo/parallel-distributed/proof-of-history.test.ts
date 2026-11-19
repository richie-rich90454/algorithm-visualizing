/**
 * proof-of-history.test.ts - Sequential hash-chain property checks, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { pohHash, simulateProofOfHistory, verifyProofOfHistory } from "./proof-of-history";
import type { VisualFrame } from "@/types";

/** Independent reimplementation of the tick hash. */
function referenceHash(value: number): number {
    let h = value >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proof of History", () => {
    it("matches an independent sequential hash recomputation", () => {
        for (const seed of [0, 1, 7, 12345, 4294967295, -3]) {
            for (const ticks of [0, 1, 2, 5, 12]) {
                const data = simulateProofOfHistory(seed, ticks);
                const expected = [(seed | 0) >>> 0];
                for (let i = 1; i <= ticks; i += 1) expected.push(referenceHash(expected[i - 1] ?? 0));
                expect(data.chain).toEqual(expected);
                expect(pohHash(expected[0] ?? 0)).toBe(referenceHash(expected[0] ?? 0));
                expect(data.verified).toBe(true);
                expect(verifyProofOfHistory(expected)).toBe(true);
                if (ticks >= 2) {
                    const tampered = [...expected];
                    tampered[1] = (tampered[1] ?? 0) + 1;
                    expect(verifyProofOfHistory(tampered)).toBe(false);
                }
            }
        }
    });

    it("verifies each link and produces well-formed frames", () => {
        const input = { seed: 12345, ticks: 8 };
        const data = simulateProofOfHistory(input.seed, input.ticks);
        for (let i = 1; i < data.chain.length; i += 1) {
            expect(data.chain[i]).toBe(pohHash(data.chain[i - 1] ?? 0));
        }
        const frames = [...mod.run(input)];
        checkFrames(frames, input.ticks + 1);
        expect(frames[frames.length - 1]?.meta["verified"]).toBe(1);
        expect(frames[frames.length - 1]?.meta["chain"]).toEqual(data.chain);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 9);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
