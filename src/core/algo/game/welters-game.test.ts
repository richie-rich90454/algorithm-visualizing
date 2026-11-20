/** welters-game.test.ts - Brute-force Grundy cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./welters-game";

function checkFrames(frames: VisualFrame[], squares: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(squares);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent nimber computation directly from the raw slide rules. */
function nimber(squares: number, mask: number, memo = new Map<number, number>()): number {
    if (memo.has(mask)) return memo.get(mask)!;
    const seen = new Set<number>();
    for (let source = 0; source < squares; source += 1) {
        if ((mask & (1 << source)) === 0) continue;
        for (let target = 0; target < source; target += 1) {
            if ((mask & (1 << target)) !== 0) continue;
            const next = (mask & ~(1 << source)) | (1 << target);
            seen.add(nimber(squares, next, memo));
        }
    }
    let value = 0;
    while (seen.has(value)) value += 1;
    memo.set(mask, value);
    return value;
}

function maskOf(coins: number[]): number {
    return coins.reduce((mask, coin) => mask | (1 << (coin - 1)), 0);
}

describe("Welter's Game", () => {
    it("reports the brute-force Grundy value for every tested position", () => {
        const positions = [[1], [2], [1, 2], [1, 3], [2, 4], [1, 2, 3, 4], [1, 3, 5], [2, 5, 6]];
        for (const coins of positions) {
            const frames = [...mod.run({ n: 6, coins })];
            checkFrames(frames, 6);
            const mask = maskOf(coins);
            expect(Number(frames[0]?.meta["grundy"])).toBe(nimber(6, mask));
        }
    });

    it("recognizes the classic paired losing positions", () => {
        for (const coins of [[1, 2], [1, 2, 3, 4]]) {
            const frames = [...mod.run({ n: 6, coins })];
            checkFrames(frames, 6);
            expect(Number(frames[0]?.meta["grundy"])).toBe(0);
            expect(frames.length).toBe(2);
        }
    });

    it("plays only legal slides and terminates", () => {
        const frames = [...mod.run({ n: 6, coins: [1, 3, 5] })];
        checkFrames(frames, 6);
        for (const frame of frames.slice(1, -1)) {
            const from = Number(frame.meta["from"]);
            const to = Number(frame.meta["to"]);
            expect(to).toBeLessThan(from);
            expect(from).toBeGreaterThanOrEqual(1);
        }
        expect(Number(frames[frames.length - 1]?.meta["grundy"])).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
