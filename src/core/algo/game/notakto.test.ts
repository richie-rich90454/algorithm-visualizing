/**
 * notakto.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./notakto";
import type { VisualFrame } from "@/types";

const LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

function hasLine(mask: number): boolean {
    return LINES.some((line) => line.every((bit) => (mask & (1 << bit)) !== 0));
}

/** Independent recursion (no memoization) for the player to move. */
function solve(mask: number): boolean {
    for (let bit = 0; bit < 9; bit += 1) {
        if ((mask & (1 << bit)) !== 0) {
            continue;
        }
        const next = mask | (1 << bit);
        if (hasLine(next)) {
            continue;
        }
        if (!solve(next)) {
            return true;
        }
    }
    return false;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(9);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(3);
    });
}

describe("Notakto", () => {
    it("classifies starting positions by an independent solver", () => {
        const boards = [".........", "X........", "XX.......", "X.X......", "X..X....."];
        for (const board of boards) {
            let mask = 0;
            for (let bit = 0; bit < 9; bit += 1) {
                if (board[bit] === "X") {
                    mask |= 1 << bit;
                }
            }
            const frames = [...mod.run({ board })];
            checkFrames(frames);
            const expected = solve(mask);
            expect(frames[0]?.meta["playerToMoveWins"]).toBe(expected);
            expect(frames[frames.length - 1]?.meta["winner"]).toBe(expected ? 1 : 2);
        }
    });

    it("only closes a line on the final losing move of the principal variation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (let i = 1; i < frames.length - 2; i += 1) {
            expect(frames[i]?.meta["closedLine"]).toBe(false);
        }
        const lastPlay = frames[frames.length - 2];
        expect(lastPlay?.meta["closedLine"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
