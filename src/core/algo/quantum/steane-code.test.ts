/**
 * steane-code.test.ts - Syndrome uniqueness, correction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { correctBitFlip, hammingCodewords, hammingSyndrome } from "./steane-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Steane Code", () => {
    it("has 16 valid codewords each with zero syndrome", () => {
        const words = hammingCodewords();
        expect(words.length).toBe(16);
        for (const word of words) expect(hammingSyndrome(word)).toBe(0);
    });

    it("gives every single-qubit error a unique nonzero syndrome and corrects it", () => {
        const words = hammingCodewords();
        const syndromes = new Set<number>();
        for (let qubit = 0; qubit < 7; qubit += 1) {
            syndromes.add(hammingSyndrome(1 << qubit));
        }
        expect(syndromes.size).toBe(7);
        expect(syndromes.has(0)).toBe(false);

        for (const codeword of words) {
            for (let qubit = 0; qubit < 7; qubit += 1) {
                const result = correctBitFlip(codeword, qubit);
                expect(result.syndrome).toBe(qubit + 1);
                expect(result.errorQubit).toBe(qubit);
                expect(result.corrected).toBe(codeword);
                expect(result.valid).toBe(true);
            }
        }
    });

    it("produces well-formed frames that restore a valid codeword", () => {
        const input = mod.defaultInput as { codeword: number; errorQubit: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, 7);
        const final = frames[frames.length - 1]!;
        expect(final.meta["valid"]).toBe(true);
        expect(Number(final.meta["syndrome"])).toBe(0);
        expect(final.meta["codeword"]).toBe(input.codeword);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
