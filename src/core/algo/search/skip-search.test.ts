import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./skip-search";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("text");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("character");
    });
}

function bruteForceMatches(text: string, pattern: string): number[] {
    if (pattern.length === 0) return [];
    const result: number[] = [];
    let from = 0;
    while (from <= text.length - pattern.length) {
        const found = text.indexOf(pattern, from);
        if (found === -1) break;
        result.push(found);
        from = found + 1;
    }
    return result;
}

function finalMatches(frames: VisualFrame[]): number[] {
    const last = frames[frames.length - 1] as VisualFrame;
    return (last.meta.matches as number[]).map(Number);
}

describe("Skip Search", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(100);
    });

    it("matches a brute-force search on the default input", () => {
        const { text, pattern } = mod.defaultInput as { text: string; pattern: string };
        expect(finalMatches(collect({ text, pattern }))).toEqual(bruteForceMatches(text, pattern));
    });

    it("matches brute force across random texts and patterns", () => {
        let seed = 445566;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const alphabet = "abc";
        for (let trial = 0; trial < 200; trial += 1) {
            const textLength = 1 + (next() % 24);
            const patternLength = 1 + (next() % 5);
            const text = Array.from({ length: textLength }, () => alphabet[next() % alphabet.length]).join("");
            const pattern = Array.from({ length: patternLength }, () => alphabet[next() % alphabet.length]).join("");
            const frames = collect({ text, pattern });
            checkFrames(frames);
            expect(finalMatches(frames), `trial ${trial}, text=${text}, pattern=${pattern}`).toEqual(
                bruteForceMatches(text, pattern),
            );
        }
    });

    it("handles an empty pattern and a pattern longer than the text", () => {
        expect(finalMatches(collect({ text: "abc", pattern: "" }))).toEqual([]);
        expect(finalMatches(collect({ text: "ab", pattern: "abcde" }))).toEqual([]);
    });
});
