import { describe, expect, it } from "vitest";
import mod from "./raita-search";

function bruteForce(text: string, pattern: string): number[] {
    const found: number[] = [];
    if (pattern.length === 0) {
        return found;
    }
    for (let i = 0; i + pattern.length <= text.length; i += 1) {
        if (text.slice(i, i + pattern.length) === pattern) {
            found.push(i);
        }
    }
    return found;
}

function finalFrame(text: string, pattern: string) {
    const all = [...mod.run({ text, pattern })];
    return { all, final: all[all.length - 1]! };
}

describe("Raita Search", () => {
    it("finds exactly the brute-force match positions on deterministic cases", () => {
        const cases: Array<[string, string]> = [
            ["abbaabaabddbabadbb", "abddb"],
            ["aaaaaa", "aa"],
            ["aaaaab", "aaab"],
            ["abcabcabc", "abc"],
            ["hello world", "world"],
            ["hello world", "xyz"],
            ["abababab", "abab"],
            ["a", "a"],
            ["abc", "abcd"],
            ["abc", ""],
        ];
        for (const [text, pattern] of cases) {
            const { final } = finalFrame(text, pattern);
            expect(final.meta["matches"]).toEqual(bruteForce(text, pattern));
        }
    });

    it("agrees with brute force on seeded random inputs", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const alphabet = "ab";
        for (let trial = 0; trial < 200; trial += 1) {
            const n = 1 + (rand() % 30);
            const m = 1 + (rand() % 6);
            let text = "";
            let pattern = "";
            for (let i = 0; i < n; i += 1) {
                text += alphabet[rand() % alphabet.length];
            }
            for (let i = 0; i < m; i += 1) {
                pattern += alphabet[rand() % alphabet.length];
            }
            const { final } = finalFrame(text, pattern);
            expect(final.meta["matches"]).toEqual(bruteForce(text, pattern));
        }
    });

    it("emits well-formed frames with sequential steps and in-range code lines", () => {
        const { all } = finalFrame("abbaabaabddbabadbb", "abddb");
        expect(all.length).toBeGreaterThan(3);
        all.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.layout).toBe("text");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
            expect(frame.entities.length).toBeGreaterThan(0);
            for (const entity of frame.entities) {
                expect(entity.type).toBe("character");
            }
            expect(Array.isArray(frame.meta["matches"])).toBe(true);
        });
    });

    it("terminates cleanly", () => {
        let count = 0;
        for (const _frame of mod.run(mod.defaultInput)) {
            count += 1;
            expect(count).toBeLessThan(5000);
        }
        expect(count).toBeGreaterThan(0);
    });
});
