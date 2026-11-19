/**
 * tic-tac-toe-solver.test.ts - Independent minimax, properties, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./tic-tac-toe-solver";
import type { VisualFrame } from "@/types";

type Mark = "X" | "O" | "";
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** Independent minimax: score terminal states, then extremize over free cells. */
function reference(board: Mark[], turn: Mark, depth: number): number {
    for (const [a, b, c] of LINES) {
        const mark = board[a];
        if (mark && mark === board[b] && mark === board[c]) {
            return mark === "X" ? 10 - depth : depth - 10;
        }
    }
    if (board.every((cell) => cell !== "")) return 0;
    const values: number[] = [];
    for (let i = 0; i < board.length; i += 1) {
        if (board[i] !== "") continue;
        const copy = board.slice();
        copy[i] = turn;
        values.push(reference(copy, turn === "X" ? "O" : "X", depth + 1));
    }
    return turn === "X" ? Math.max(...values) : Math.min(...values);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(9);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(3);
    });
}

describe("Tic-Tac-Toe Solver", () => {
    it("matches independent minimax on several positions", () => {
        const positions: Array<{ board: Mark[]; turn: Mark }> = [
            { board: ["X", "X", "", "O", "O", "", "", "", ""], turn: "X" },
            { board: ["X", "", "", "", "O", "", "", "", ""], turn: "X" },
            { board: ["X", "O", "X", "", "O", "", "", "X", "O"], turn: "X" },
        ];
        for (const pos of positions) {
            const frames = [...mod.run(pos)];
            checkFrames(frames);
            const value = Number(frames[frames.length - 1]?.meta["value"]);
            const expected = reference(pos.board, pos.turn, 0);
            expect(value).toBe(expected);
        }
    });

    it("takes the immediate win when available", () => {
        const board: Mark[] = ["X", "X", "", "O", "O", "", "", "", ""];
        const frames = [...mod.run({ board, turn: "X" })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["value"]).toBe(9);
        expect(final?.["bestMoves"]).toEqual([2]);
    });

    it("draws from an empty board and considers nine moves", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["value"]).toBe(0);
        expect((frames[frames.length - 1]?.meta["candidates"] as string[]).length).toBe(9);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(9 + 2);
        expect(gen.next().done).toBe(true);
    });
});
