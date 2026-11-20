/**
 * longest-repeated-substring.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./longest-repeated-substring";
import type { VisualFrame } from "@/types";

/** Brute force: try every substring length from longest down and find one that occurs twice. */
function brute(text: string): { value: string; occurrences: number[] } {
    for (let length = text.length - 1; length >= 1; length -= 1) {
        const seen = new Map<string, number[]>();
        for (let i = 0; i + length <= text.length; i += 1) {
            const sub = text.slice(i, i + length);
            const list = seen.get(sub) ?? [];
            list.push(i);
            seen.set(sub, list);
        }
        for (const [sub, positions] of seen) {
            if (positions.length >= 2) {
                return { value: sub, occurrences: positions };
            }
        }
    }
    return { value: "", occurrences: [] };
}

function checkFrames(frames: VisualFrame[], textLength: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLength);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Longest Repeated Substring", () => {
    it("matches brute force on the default input", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.text.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["longestRepeated"]).toBe(brute(input.text).value);
        expect(finalMeta?.["bestLength"]).toBe(brute(input.text).value.length);
    });

    it("matches brute force on randomized inputs", () => {
        const alphabet = "abc";
        let seed = 19;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 60; t += 1) {
            const text = Array.from({ length: 1 + (rand() % 14) }, () => alphabet[rand() % alphabet.length]).join("");
            const frames = [...mod.run({ text })];
            checkFrames(frames, text.length);
            const finalMeta = frames[frames.length - 1]?.meta;
            const expected = brute(text);
            const value = finalMeta?.["longestRepeated"] as string;
            const occurrences = finalMeta?.["occurrences"] as number[];
            expect(value.length).toBe(expected.value.length);
            expect(finalMeta?.["bestLength"]).toBe(expected.value.length);
            if (value.length === 0) {
                expect(occurrences).toEqual([]);
            } else {
                expect(occurrences.length).toBeGreaterThanOrEqual(2);
                for (const pos of occurrences) {
                    expect(text.slice(pos, pos + value.length)).toBe(value);
                }
            }
        }
    });

    it("reports no repeat for a unique-character string", () => {
        const frames = [...mod.run({ text: "abcdef" })];
        checkFrames(frames, 6);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["longestRepeated"]).toBe("");
        expect(finalMeta?.["occurrences"]).toEqual([]);
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
