/**
 * clobber.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./clobber";
import type { VisualFrame } from "@/types";

const B = 1;
const W = 2;

function parse(s: string): number[] {
    return [...s].map((ch) => (ch === "B" ? B : ch === "W" ? W : 0));
}

function moves(board: number[], rows: number, cols: number, player: number): number[][] {
    const foe = player === B ? W : B;
    const out: number[][] = [];
    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            const from = r * cols + c;
            if (board[from] !== player) {
                continue;
            }
            for (const [nr, nc] of [
                [r - 1, c],
                [r + 1, c],
                [r, c - 1],
                [r, c + 1],
            ]) {
                if (nr === undefined || nc === undefined || nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    continue;
                }
                const to = nr * cols + nc;
                if (board[to] === foe) {
                    out.push([from, to]);
                }
            }
        }
    }
    return out;
}

/** Independent recursion without memoization for the player to move. */
function solve(board: number[], rows: number, cols: number, player: number): boolean {
    for (const [from, to] of moves(board, rows, cols, player)) {
        if (from === undefined || to === undefined) {
            continue;
        }
        const next = [...board];
        next[from] = 0;
        next[to] = player;
        if (!solve(next, rows, cols, player === B ? W : B)) {
            return true;
        }
    }
    return false;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

describe("Clobber", () => {
    it("classifies outcomes against an independent solver", () => {
        const cases: Array<{ rows: number; cols: number; board: string }> = [
            { rows: 1, cols: 3, board: "BWB" },
            { rows: 1, cols: 2, board: "BW" },
            { rows: 2, cols: 3, board: "BWBWBW" },
            { rows: 2, cols: 2, board: "BWWB" },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.rows, testCase.cols);
            const expected = solve(parse(testCase.board), testCase.rows, testCase.cols, B);
            expect(frames[0]?.meta["blackWins"]).toBe(expected);
            expect(frames[frames.length - 1]?.meta["winner"]).toBe(expected ? 1 : 2);
        }
    });

    it("plays only legal captures that remove one stone", () => {
        const input = { rows: 2, cols: 3, board: "BWBWBW" };
        const frames = [...mod.run(input)];
        let board = parse(input.board);
        for (let i = 1; i < frames.length - 1; i += 1) {
            const meta = frames[i]?.meta;
            const from = Number(meta?.["from"]);
            const to = Number(meta?.["to"]);
            const player = Number(meta?.["player"]);
            const foe = player === B ? W : B;
            expect(board[from]).toBe(player);
            expect(board[to]).toBe(foe);
            const dr = Math.abs(Math.floor(from / 3) - Math.floor(to / 3));
            const dc = Math.abs((from % 3) - (to % 3));
            expect(dr + dc).toBe(1);
            const before = board.filter((v) => v !== 0).length;
            board[from] = 0;
            board[to] = player;
            expect(board.filter((v) => v !== 0).length).toBe(before - 1);
        }
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
