import { describe, expect, it } from "vitest";
import mod from "./star2-search";

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function minimax(leaves: number[]): number {
    const evaluate = (lo: number, hi: number, isMax: boolean): number => {
        if (hi - lo === 1) return leaves[lo] ?? 0;
        const mid = (lo + hi) >> 1;
        const a = evaluate(lo, mid, !isMax);
        const b = evaluate(mid, hi, !isMax);
        return isMax ? Math.max(a, b) : Math.min(a, b);
    };
    return evaluate(0, leaves.length, true);
}

describe("star2-search", () => {
    it("returns the exact minimax value on random game trees", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const rand = rng(trial + 31);
            const leaves = Array.from({ length: 8 }, () => Math.floor(rand() * 20) - 10);
            const frames = Array.from(mod.run({ leaves }));
            const final = frames[frames.length - 1];
            expect(final?.meta["value"]).toBe(minimax(leaves));
        }
    });

    it("agrees with brute force on the worked example", () => {
        const leaves = [5, 1, 6, 2, 7, 3, 8, 4];
        const frames = Array.from(mod.run({ leaves }));
        expect(frames[frames.length - 1]?.meta["value"]).toBe(minimax(leaves));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = Array.from(mod.run(mod.defaultInput));
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.length).toBeLessThan(200);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("tree");
            expect(frame.meta).toBeDefined();
        });
    });
});
