/**
 * relative-lcp-array.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./relative-lcp-array";
import type { VisualFrame } from "@/types";

/** Brute force: count matching leading characters of the pattern at each text position. */
function brute(text: string, pattern: string): number[] {
    if (pattern.length === 0 || text.length === 0) {
        return [];
    }
    const out: number[] = [];
    for (let i = 0; i < text.length; i += 1) {
        let k = 0;
        while (k < pattern.length && i + k < text.length && text[i + k] === pattern[k]) {
            k += 1;
        }
        out.push(k);
    }
    return out;
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

describe("Relative LCP Array", () => {
    it("matches brute force on the default input", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.text.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["rlcpArray"]).toEqual(brute(input.text, input.pattern));
    });

    it("matches brute force on randomized inputs", () => {
        const alphabet = "ab";
        let seed = 31;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 60; t += 1) {
            const text = Array.from({ length: 1 + (rand() % 14) }, () => alphabet[rand() % alphabet.length]).join("");
            const pattern = Array.from({ length: 1 + (rand() % 6) }, () => alphabet[rand() % alphabet.length]).join("");
            const frames = [...mod.run({ text, pattern })];
            checkFrames(frames, text.length);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["rlcpArray"]).toEqual(brute(text, pattern));
        }
    });

    it("matches brute force when text and pattern share no characters", () => {
        const frames = [...mod.run({ text: "aaaa", pattern: "b" })];
        checkFrames(frames, 4);
        expect(frames[frames.length - 1]?.meta["rlcpArray"]).toEqual([0, 0, 0, 0]);
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
