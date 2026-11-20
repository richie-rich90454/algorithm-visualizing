/**
 * minimum-cost-merge-stones.test.ts - Brute-force merge-order cross-check.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./minimum-cost-merge-stones";

function bruteForceCost(stones: number[], k: number): number {
    const memo = new Map<string, number>();
    const solve = (current: number[]): number => {
        if (current.length === 1) return 0;
        const key = current.join(",");
        const cached = memo.get(key);
        if (cached !== undefined) return cached;
        let best = Number.POSITIVE_INFINITY;
        for (let i = 0; i + k <= current.length; i += 1) {
            let merged = 0;
            for (let j = i; j < i + k; j += 1) merged += current[j] ?? 0;
            const next = [...current.slice(0, i), merged, ...current.slice(i + k)];
            best = Math.min(best, merged + solve(next));
        }
        memo.set(key, best);
        return best;
    };
    return solve(stones);
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(entity.metadata.row).toBeTypeOf("number");
            expect(entity.metadata.col).toBeTypeOf("number");
        }
    });
}

describe("Minimum Cost to Merge Stones", () => {
    it("matches exhaustive merge-order enumeration", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const k = 2 + (trial % 3);
            const merges = 1 + (trial % 4);
            const n = merges * (k - 1) + 1;
            const stones = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 12));
            const frames = [...module.run({ stones, k })];
            verifyFrameShapes(frames);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            expect(final?.meta.feasible).toBe(true);
            expect(final?.meta.answer).toBe(bruteForceCost(stones, k));
        }
    });

    it("rejects infeasible pile counts and handles a single pile", () => {
        const infeasible = [...module.run({ stones: [1, 2, 3, 4], k: 3 })];
        expect(infeasible).toHaveLength(1);
        expect(infeasible[0]?.meta.feasible).toBe(false);
        verifyFrameShapes(infeasible);
        const single = [...module.run({ stones: [7], k: 2 })];
        expect(single[single.length - 1]?.meta.answer).toBe(0);
        verifyFrameShapes(single);
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
