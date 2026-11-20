/**
 * weighted-edit-distance.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./weighted-edit-distance";
import type { VisualFrame } from "@/types";

function brute(
    source: string,
    target: string,
    insertCost: number,
    deleteCost: number,
    replace: Record<string, number>,
): number {
    const fallback = typeof replace["*"] === "number" ? replace["*"] : 1;
    const sub = (a: string, b: string): number => {
        if (a === b) return 0;
        const pair = replace[`${a}:${b}`];
        return typeof pair === "number" ? pair : fallback;
    };
    const solve = (i: number, j: number): number => {
        if (i === source.length) return (target.length - j) * insertCost;
        if (j === target.length) return (source.length - i) * deleteCost;
        return Math.min(
            deleteCost + solve(i + 1, j),
            insertCost + solve(i, j + 1),
            sub(source[i]!, target[j]!) + solve(i + 1, j + 1),
        );
    };
    return solve(0, 0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Weighted Edit Distance", () => {
    it("matches exhaustive edit-script recursion on random short strings", () => {
        const alphabet = "abc";
        let seed = 5150;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % alphabet.length;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const source = Array.from({ length: trial % 5 }, () => alphabet[rand()]).join("");
            const target = Array.from({ length: (trial + 1) % 5 }, () => alphabet[rand()]).join("");
            const insertCost = 1 + (trial % 3);
            const deleteCost = 1 + ((trial + 1) % 3);
            const replace = { "*": 1 + (trial % 4), "a:b": 2 };
            const frames = [...mod.run({ source, target, insertCost, deleteCost, replace })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(
                brute(source, target, insertCost, deleteCost, replace),
            );
        }
    });

    it("gives the documented default answer of 1", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
