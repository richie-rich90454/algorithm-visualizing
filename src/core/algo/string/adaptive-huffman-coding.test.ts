/**
 * adaptive-huffman-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adaptive-huffman-coding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], textLength: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLength);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent prefix-free check over a list of code strings. */
function isPrefixFree(codes: string[]): boolean {
    for (let i = 0; i < codes.length; i += 1) {
        for (let j = 0; j < codes.length; j += 1) {
            if (i !== j && (codes[j] as string).startsWith(codes[i] as string)) {
                return false;
            }
        }
    }
    return true;
}

describe("Adaptive Huffman coding", () => {
    it("round-trips varied texts with a prefix-free code at every step", () => {
        const texts = ["aab", "abracadabra", "mississippi", "aaaa", "abcabcabc"];
        for (const text of texts) {
            const frames = [...mod.run({ text })];
            checkFrames(frames, text.length);
            const final = frames[frames.length - 1]!.meta;
            expect(final["roundTrip"]).toBe(true);
            expect(final["prefixFree"]).toBe(true);
            const bits = final["bits"] as string;
            expect(bits.length).toBeGreaterThan(0);
            expect(bits.length).toBe(final["totalBits"]);
        }
    });

    it("the emitted bits equal the sum of the per-symbol code lengths", () => {
        const text = "abracadabra";
        const frames = [...mod.run({ text })];
        const stepFrames = frames.slice(1, -1);
        let sum = 0;
        for (const frame of stepFrames) {
            sum += frame.meta["stepBits"] as number;
            const codes = [...new Set(frame.entities.map((e) => e.metadata["code"] as string))];
            expect(isPrefixFree(codes)).toBe(true);
        }
        expect(sum).toBe((frames[frames.length - 1]!.meta["bits"] as string).length);
    });

    it("repeated characters eventually receive short codes", () => {
        const frames = [...mod.run({ text: "aaaaaaaaaa" })];
        const last = frames[frames.length - 2]!;
        const code = last.entities[0]!.metadata["code"] as string;
        expect(code.length).toBeLessThanOrEqual(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
