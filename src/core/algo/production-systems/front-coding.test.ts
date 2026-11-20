/**
 * front-coding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { commonPrefixLength, frontCode, frontDecode } from "./front-coding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(3);
    });
}

/** Naive longest-common-prefix reference. */
function naiveLcp(a: string, b: string): number {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    return i;
}

describe("Front Coding Compression", () => {
    it("computes prefix lengths exactly", () => {
        expect(commonPrefixLength("", "abc")).toBe(0);
        expect(commonPrefixLength("abc", "abc")).toBe(3);
        expect(commonPrefixLength("cat", "catalog")).toBe(3);
        expect(commonPrefixLength("dogma", "door")).toBe(2);
        for (let a = 0; a < 40; a += 1) {
            for (let b = 0; b < 40; b += 1) {
                const sa = "a".repeat(a % 7) + "xyz";
                const sb = "a".repeat(b % 7) + "x" + "q".repeat(b % 5);
                expect(commonPrefixLength(sa, sb)).toBe(naiveLcp(sa, sb));
            }
        }
    });

    it("round-trips sorted word lists exactly", () => {
        const lists = [
            ["cat", "catalog", "category", "cater", "dog", "dogma", "door", "doors"],
            ["a", "ab", "abc", "abcd", "b", "ba"],
            ["single"],
            ["zebra"],
        ];
        for (const words of lists) {
            expect(frontDecode(frontCode(words))).toEqual(words);
            const entries = frontCode(words);
            entries.forEach((entry, i) => {
                expect(entry.prefix).toBe(i === 0 ? 0 : naiveLcp(words[i - 1]!, words[i]!));
                expect(entry.suffix).toBe(words[i]!.slice(entry.prefix));
            });
        }
    });

    it("emits well-formed frames whose final meta decodes correctly", () => {
        const input = mod.defaultInput as { words: string[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.words.length);
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(finalMeta["encoded"]).toEqual(
            frontCode(input.words).map((entry) => `${entry.prefix}:${entry.suffix}`),
        );
        expect(finalMeta["decoded"]).toEqual(input.words);
        expect(finalMeta["storedChars"]).toBe(
            frontCode(input.words).reduce((sum, e) => sum + e.suffix.length, 0),
        );
        expect(Number(finalMeta["storedChars"])).toBeLessThan(Number(finalMeta["originalChars"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
