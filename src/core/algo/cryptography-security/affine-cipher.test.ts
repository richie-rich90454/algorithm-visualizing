/** affine-cipher.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./affine-cipher";
import type { VisualFrame } from "@/types";

const VALID_A = [1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];

/** Independent reference affine encryption. */
function reference(text: string, a: number, b: number): string {
    return [...text]
        .map((ch) => {
            const code = ch.toUpperCase().charCodeAt(0) - 65;
            if (code < 0 || code > 25) return ch;
            return String.fromCharCode(65 + ((a * code + b) % 26));
        })
        .join("");
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedChars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(expectedChars);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const outputOf = (input: unknown): string => {
    const frames = [...mod.run(input)];
    return String(frames[frames.length - 1]?.meta["output"]);
};

describe("Affine Cipher", () => {
    it("matches an independent reference for every valid key", () => {
        const text = "THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 123!";
        for (const a of VALID_A) {
            for (let b = 0; b < 26; b += 1) {
                const frames = [...mod.run({ text, a, b, mode: "encrypt" })];
                checkFrames(frames, [...text].length);
                expect(outputOf({ text, a, b, mode: "encrypt" })).toBe(reference(text, a, b));
            }
        }
    });

    it("round-trips for all valid multipliers and shifts", () => {
        const text = "abcdefghijklmnopqrstuvwxyz, ABC XYZ!";
        for (const a of VALID_A) {
            for (const b of [0, 1, 8, 13, 25]) {
                const encrypted = outputOf({ text, a, b, mode: "encrypt" });
                const decrypted = outputOf({ text: encrypted, a, b, mode: "decrypt" });
                expect(decrypted.toUpperCase()).toBe(text.toUpperCase());
            }
        }
    });

    it("maps the alphabet bijectively and normalizes invalid multipliers", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const mapped = outputOf({ text: alphabet, a: 7, b: 3, mode: "encrypt" });
        expect(new Set([...mapped]).size).toBe(26);
        const frames = [...mod.run({ text: "ABC", a: 2, b: 1, mode: "encrypt" })];
        expect(frames[0]?.meta["validMultiplier"]).toBe(false);
        expect(frames[0]?.meta["a"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
