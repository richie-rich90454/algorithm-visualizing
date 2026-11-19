/** Correctness, frame shape, and termination checks for SA-IS. */
import { describe, expect, it } from "vitest";
import mod from "./sa-is-suffix-array";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.id).toBeTruthy());
    });
}

/** Reference suffix array by sorting all suffixes with the built-in comparator. */
function bruteSuffixArray(text: string): number[] {
    return text
        .split("")
        .map((_, i) => i)
        .sort((a, b) => {
            const sa = text.slice(a);
            const sb = text.slice(b);
            return sa < sb ? -1 : sa > sb ? 1 : 0;
        });
}

describe("SA-IS Suffix Array", () => {
    const cases = ["", "a", "aa", "ab", "banana", "mississippi", "aaaaaaaa", "abcabcabc", "ababababab"];
    for (const text of cases) {
        it(`matches the brute-force suffix array for ${JSON.stringify(text)}`, () => {
            const frames = [...mod.run({ text })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["suffixArray"]).toEqual(bruteSuffixArray(text));
        });
    }

    it("matches the reference on deterministic random strings", () => {
        let seed = 98765;
        const rnd = (): number => {
            seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let t = 0; t < 30; t += 1) {
            const text = Array.from({ length: 1 + Math.floor(rnd() * 12) }, () =>
                "abc"[Math.floor(rnd() * 3)],
            ).join("");
            const frames = [...mod.run({ text })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["suffixArray"]).toEqual(bruteSuffixArray(text));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
