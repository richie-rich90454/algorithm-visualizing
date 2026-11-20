/**
 * candy-dp.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./candy-dp";
import type { VisualFrame } from "@/types";

/** Exhaustively search every small candy assignment for the minimum total. */
function brute(ratings: number[]): number {
    const n = ratings.length;
    if (n === 0) return 0;
    let best = Infinity;
    const max = n;
    const total = max ** n;
    for (let code = 0; code < total; code += 1) {
        let x = code;
        const candies: number[] = [];
        for (let i = 0; i < n; i += 1) {
            candies.push((x % max) + 1);
            x = Math.floor(x / max);
        }
        let valid = true;
        for (let i = 1; i < n; i += 1) {
            if (ratings[i]! > ratings[i - 1]! && candies[i]! <= candies[i - 1]!) {
                valid = false;
                break;
            }
            if (ratings[i - 1]! > ratings[i]! && candies[i - 1]! <= candies[i]!) {
                valid = false;
                break;
            }
        }
        if (valid) best = Math.min(best, candies.reduce((a, b) => a + b, 0));
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Candy DP", () => {
    it("matches exhaustive search on small random inputs", () => {
        let seed = 987;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 5;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const n = 1 + (trial % 5);
            const ratings = Array.from({ length: n }, () => rand());
            const frames = [...mod.run({ ratings })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(ratings));
        }
    });

    it("gives the documented answer of 5 for [1,0,2]", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(5);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
