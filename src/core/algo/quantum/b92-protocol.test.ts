/**
 * b92-protocol.test.ts - Conclusive inference, eavesdropping errors, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateB92 } from "./b92-protocol";
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
        expect(frame.meta["cols"]).toBe(rounds);
    });
}

describe("B92 protocol (toy)", () => {
    it("conclusive outcomes are always correct without an eavesdropper", () => {
        const bits: Array<0 | 1> = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1];
        for (const seed of [1, 2, 3, 7, 11, 42, 100]) {
            const rounds = simulateB92(bits, seed, false);
            let conclusive = 0;
            for (const round of rounds) {
                if (round.conclusive) {
                    conclusive += 1;
                    expect(round.correct).toBe(true);
                    expect(round.inferredBit).toBe(round.aliceBit);
                    if (round.bobBasis === "Z") {
                        expect(round.bobOutcome).toBe("1");
                    } else {
                        expect(round.bobOutcome).toBe("-");
                    }
                }
            }
            expect(conclusive).toBeGreaterThan(0);
        }
    });

    it("about a quarter of rounds are conclusive in the ideal case", () => {
        const bits: Array<0 | 1> = Array.from({ length: 2000 }, (_, index) => (index % 2 === 0 ? 0 : 1));
        let total = 0;
        for (const seed of [1, 2, 3, 4, 5]) {
            total += simulateB92(bits, seed, false).filter((round) => round.conclusive).length;
        }
        const rate = total / (bits.length * 5);
        expect(rate).toBeGreaterThan(0.2);
        expect(rate).toBeLessThan(0.3);
    });

    it("an intercept-and-resend attacker introduces errors in conclusive rounds", () => {
        const bits: Array<0 | 1> = Array.from({ length: 400 }, (_, index) => (index * 7 % 5 < 2 ? 0 : 1));
        let totalErrors = 0;
        let totalConclusive = 0;
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const rounds = simulateB92(bits, seed, true);
            for (const round of rounds) {
                if (round.conclusive) {
                    totalConclusive += 1;
                    if (!round.correct) {
                        totalErrors += 1;
                    }
                }
            }
        }
        expect(totalConclusive).toBeGreaterThan(0);
        expect(totalErrors).toBeGreaterThan(0);
        expect(totalErrors / totalConclusive).toBeGreaterThan(0.05);
    });

    it("final key is built only from conclusive bits", () => {
        const input = mod.defaultInput as { bits: Array<0 | 1>; seed: number; eavesdropper: boolean };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.bits.length);
        const final = frames[frames.length - 1]?.meta;
        const indices = final?.["conclusiveIndices"] as number[];
        expect(final?.["key"]).toBe(indices.map((index) => input.bits[index]).join(""));
        expect(final?.["keyLength"]).toBe(indices.length);
        expect(final?.["errorCount"]).toBe(0);
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
