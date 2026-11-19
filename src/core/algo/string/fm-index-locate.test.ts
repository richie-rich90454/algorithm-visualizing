/**
 * fm-index-locate.test.ts - Brute-force occurrence check across many strings
 * and patterns, empty and absent patterns, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fm-index-locate";
import type { VisualFrame } from "@/types";

function brute(text: string, pattern: string): number[] {
    const out: number[] = [];
    for (let i = 0; i + pattern.length <= text.length; i += 1) {
        if (text.slice(i, i + pattern.length) === pattern) out.push(i);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], textLen: number, patternLen: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLen + 1 + patternLen);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FmIndexLocate", () => {
    it("locates exactly the brute-force occurrence positions", () => {
        const cases: Array<[string, string]> = [
            ["banana", "ana"],
            ["mississippi", "issi"],
            ["aaa", "a"],
            ["aaa", "aa"],
            ["ababab", "abab"],
            ["abcabc", "xyz"],
            ["abcabc", "c"],
            ["banana", "z"],
        ];
        for (const [text, pattern] of cases) {
            for (const sampling of [1, 3, 5]) {
                const frames = [...mod.run({ text, pattern, sampling })];
                checkFrames(frames, text.length, pattern.length);
                const actual = [...(frames[frames.length - 1].meta["positions"] as number[])].sort((a, b) => a - b);
                expect(actual).toEqual(brute(text, pattern));
            }
        }
    });

    it("treats the empty pattern as occurring at every position", () => {
        const final = [...mod.run({ text: "abc", pattern: "", sampling: 2 })].at(-1);
        expect(final?.meta["positions"]).toEqual([0, 1, 2]);
    });

    it("returns no positions when the text is empty of the pattern", () => {
        expect([...mod.run({ text: "abc", pattern: "abcd" })].at(-1)?.meta["positions"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(4);
        expect(generator.next().done).toBe(true);
    });
});
