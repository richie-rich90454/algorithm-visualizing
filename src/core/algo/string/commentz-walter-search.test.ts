import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./commentz-walter-search";

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

function brute(text: string, patterns: string[]): string[] {
    const out: string[] = [];
    for (const p of patterns) {
        for (let i = 0; i <= text.length - p.length; i += 1) {
            if (text.slice(i, i + p.length) === p) out.push(`${p}@${i}`);
        }
    }
    return out.sort();
}

describe("CommentzWalterSearch", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("finds exactly the brute-force matches for all patterns", () => {
        const cases: Array<{ text: string; patterns: string[] }> = [
            { text: "the quick brown fox jumps over the lazy dog", patterns: ["the", "quick", "fox", "lazy"] },
            { text: "aaaaaaaaaa", patterns: ["aa", "aaa", "a"] },
            { text: "abracadabra", patterns: ["abra", "cad", "bra", "zzz"] },
            { text: "abcabcabc", patterns: ["abc", "bca", "cab"] },
            { text: "hello", patterns: [] },
        ];
        for (const cfg of cases) {
            const frames = [...module.run(cfg)];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const got = (last.meta.matches as string[]).slice().sort();
            expect(got).toEqual(brute(cfg.text, cfg.patterns));
        }
    });
});
