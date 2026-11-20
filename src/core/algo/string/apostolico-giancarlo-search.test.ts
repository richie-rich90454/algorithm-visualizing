import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./apostolico-giancarlo-search";

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

function brute(text: string, pattern: string): number[] {
    const out: number[] = [];
    if (pattern.length === 0) return out;
    for (let i = 0; i <= text.length - pattern.length; i += 1) {
        if (text.slice(i, i + pattern.length) === pattern) out.push(i);
    }
    return out;
}

describe("ApostolicoGiancarloSearch", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("finds exactly the brute-force match positions", () => {
        const cases: Array<[string, string]> = [
            ["abababababababab", "abab"],
            ["aaaaaaaaaa", "aaa"],
            ["abcabcxyzabc", "abc"],
            ["hello world", "query"],
            ["banana", "an"],
            ["abc", "abcdef"],
            ["abc", ""],
            ["aaaaa", "aaaaa"],
        ];
        for (const [text, pattern] of cases) {
            const frames = [...module.run({ text, pattern })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.positions).toEqual(brute(text, pattern));
        }
    });
});
