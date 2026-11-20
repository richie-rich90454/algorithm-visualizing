import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./osa-distance";

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

function brute(a: string, b: string): number {
    const memo = new Map<string, number>();
    const solve = (i: number, j: number): number => {
        const key = `${i},${j}`;
        const hit = memo.get(key);
        if (hit !== undefined) return hit;
        if (i === 0) return j;
        if (j === 0) return i;
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let best = Math.min(solve(i - 1, j) + 1, solve(i, j - 1) + 1, solve(i - 1, j - 1) + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            best = Math.min(best, solve(i - 2, j - 2) + 1);
        }
        memo.set(key, best);
        return best;
    };
    return solve(a.length, b.length);
}

describe("Optimal String Alignment Distance", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches an independent recursive implementation", () => {
        const cases: Array<[string, string]> = [
            ["", ""], ["abc", "abc"], ["CA", "ABC"], ["kitten", "sitting"],
            ["ab", "ba"], ["abcd", "badc"], ["aaaa", "aa"], ["x", "yz"],
        ];
        for (const [a, b] of cases) {
            const frames = [...module.run({ a, b })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.distance).toBe(brute(a, b));
            const dp = last.meta.dp as number[][];
            expect(dp[a.length]![b.length]).toBe(last.meta.distance);
        }
    });
});
