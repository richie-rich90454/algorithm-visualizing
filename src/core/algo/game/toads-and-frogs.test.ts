/**
 * toads-and-frogs.test.ts - Independent outcome solver and legal-play checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./toads-and-frogs";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
    }
}

function leftMovesRef(board: string): string[] {
    const out: string[] = [];
    for (let i = 0; i + 1 < board.length; i += 1) {
        if (board.slice(i, i + 2) === "T.") {
            out.push(board.slice(0, i) + ".T" + board.slice(i + 2));
        }
    }
    for (let i = 0; i + 2 < board.length; i += 1) {
        if (board.slice(i, i + 3) === "TF.") {
            out.push(board.slice(0, i) + ".FT" + board.slice(i + 3));
        }
    }
    return out;
}

function rightMovesRef(board: string): string[] {
    const out: string[] = [];
    for (let i = 0; i + 1 < board.length; i += 1) {
        if (board.slice(i, i + 2) === ".F") {
            out.push(board.slice(0, i) + "F." + board.slice(i + 2));
        }
    }
    for (let i = 0; i + 2 < board.length; i += 1) {
        if (board.slice(i, i + 3) === ".FT") {
            out.push(board.slice(0, i) + "TF." + board.slice(i + 3));
        }
    }
    return out;
}

function referenceOutcome(board: string): string {
    const startMemo = new Map<string, boolean>();
    const replyMemo = new Map<string, boolean>();
    const start = (b: string): boolean => {
        if (startMemo.has(b)) {
            return startMemo.get(b) ?? false;
        }
        startMemo.set(b, false);
        const value = leftMovesRef(b).some((next) => reply(next));
        startMemo.set(b, value);
        return value;
    };
    const reply = (b: string): boolean => {
        if (replyMemo.has(b)) {
            return replyMemo.get(b) ?? false;
        }
        replyMemo.set(b, true);
        const moves = rightMovesRef(b);
        if (moves.length === 0) {
            return true;
        }
        const value = moves.every((next) => start(next));
        replyMemo.set(b, value);
        return value;
    };
    const s = start(board);
    const r = reply(board);
    if (s && r) {
        return "L";
    }
    if (!s && !r) {
        return "R";
    }
    return s ? "N" : "P";
}

describe("Toads and Frogs", () => {
    it("classifies the default board and plays legal moves", () => {
        const input = mod.defaultInput as { board: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["outcome"]).toBe(referenceOutcome(input.board));
        const boards = frames.map((f) => String(f.meta["board"]));
        for (let i = 1; i < boards.length - 1; i += 1) {
            const prev = boards[i - 1] ?? "";
            const next = boards[i] ?? "";
            expect(leftMovesRef(prev).includes(next) || rightMovesRef(prev).includes(next)).toBe(true);
        }
    });

    it("agrees with an independent solver on many boards", () => {
        const boards = ["T.F", "T..F", "TF.", ".TF", "TT..FF", "T.F.", ".T.F", "T..F.", "FT.", "TFFF."];
        for (const board of boards) {
            const frames = [...mod.run({ board })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["outcome"]).toBe(referenceOutcome(board));
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
