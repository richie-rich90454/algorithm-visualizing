import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./farach-colton-suffix-array";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

/** Independent suffix array by directly sorting suffixes. */
function bruteSuffixArray(text: string): number[] {
    return Array.from({ length: text.length }, (_, i) => i).sort((a, b) => {
        const sa = text.slice(a);
        const sb = text.slice(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
}

describe("FarachColtonSuffixArray", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches the brute-force suffix array, including repeated characters", () => {
        const texts = ["banana", "aaaa", "mississippi", "abcabcabc", "a", "ababab", "thequickbrownfox"];
        for (const text of texts) {
            const frames = [...module.run({ text })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.suffixArray).toEqual(bruteSuffixArray(text));
        }
    });
});
