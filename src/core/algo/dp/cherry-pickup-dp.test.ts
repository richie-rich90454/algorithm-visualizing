/**
 * cherry-pickup-dp.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./cherry-pickup-dp";
import type { VisualFrame } from "@/types";

/** Search every pair of right/down move sequences independently. */
function brute(board: number[][]): number {
    const n = board.length;
    if (n === 0) return 0;
    let best = -Infinity;
    const walk = (
        k: number,
        r1: number,
        r2: number,
        gained: Set<string>,
        total: number,
    ): void => {
        if (k === 2 * n - 2) {
            best = Math.max(best, total);
            return;
        }
        for (let d1 = 0; d1 <= 1; d1 += 1) {
            for (let d2 = 0; d2 <= 1; d2 += 1) {
                const nr1 = r1 + d1;
                const nr2 = r2 + d2;
                const c1 = k + 1 - nr1;
                const c2 = k + 1 - nr2;
                if (nr1 >= n || nr2 >= n || c1 < 0 || c1 >= n || c2 < 0 || c2 >= n) continue;
                const key1 = `${nr1},${c1}`;
                const key2 = `${nr2},${c2}`;
                let add = 0;
                const nextSet = new Set(gained);
                if (!nextSet.has(key1)) {
                    add += board[nr1]?.[c1] ?? 0;
                    nextSet.add(key1);
                }
                if (!nextSet.has(key2)) {
                    add += board[nr2]?.[c2] ?? 0;
                    nextSet.add(key2);
                }
                walk(k + 1, nr1, nr2, nextSet, total + add);
            }
        }
    };
    walk(0, 0, 0, new Set(["0,0"]), board[0]?.[0] ?? 0);
    return best;
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

describe("Cherry Pickup DP", () => {
    it("matches exhaustive two-walker search on small boards", () => {
        let seed = 321;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 3;
        };
        for (let trial = 0; trial < 6; trial += 1) {
            const n = 2 + (trial % 3);
            const board = Array.from({ length: n }, () => Array.from({ length: n }, () => rand()));
            const frames = [...mod.run({ board })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(board));
        }
    });

    it("gives the documented default answer", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const board = (mod.defaultInput as { board: number[][] }).board;
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(board));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
