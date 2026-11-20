import { describe, expect, it } from "vitest";
import mod from "./compressed-suffix-array";

function suffixArray(text: string): number[] {
    const indices = Array.from({ length: text.length }, (_, i) => i);
    indices.sort((a, b) => (text.slice(a) < text.slice(b) ? -1 : text.slice(a) > text.slice(b) ? 1 : 0));
    return indices;
}

function occurrences(text: string, pattern: string): number[] {
    const out: number[] = [];
    for (let i = 0; i <= text.length - pattern.length; i += 1) {
        if (text.slice(i, i + pattern.length) === pattern) out.push(i);
    }
    return out;
}

describe("compressed-suffix-array", () => {
    it("recovers every suffix-array row by LF locate", () => {
        for (const text of ["banana", "mississippi", "aaaa", "abcab", "a"]) {
            const frames = Array.from(mod.run({ text, patterns: ["a"], samplePeriod: 3 }));
            const final = frames[frames.length - 1];
            expect(final?.meta["located"]).toEqual(suffixArray(`${text}$`));
        }
    });

    it("counts and locates patterns matching a naive scan", () => {
        const cases: Array<[string, string[]]> = [
            ["banana", ["ana", "nan", "a", "na", "zz"]],
            ["mississippi", ["issi", "ssi", "i", "ppi", "miss"]],
            ["abcab", ["ab", "bca", "c", "abcab"]],
        ];
        for (const [text, patterns] of cases) {
            const frames = Array.from(mod.run({ text, patterns, samplePeriod: 2 }));
            const final = frames[frames.length - 1];
            expect(final?.meta["results"]).toEqual(
                Object.fromEntries(patterns.map((p) => [p, occurrences(text, p)])),
            );
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = Array.from(mod.run(mod.defaultInput));
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.length).toBeLessThan(100);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("grid");
            expect(frame.meta).toBeDefined();
        });
    });
});
