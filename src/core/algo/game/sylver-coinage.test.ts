/**
 * sylver-coinage.test.ts - Opening verdicts against an independent game-tree
 * search, plus terminal and response properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sylver-coinage";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        const seen = new Set(frame.entities.map((e) => e.id));
        expect(seen.size).toBe(frame.entities.length);
    }
}

/** Independent unbounded-knapsack sieve and plain recursive game solver. */
function isRepresentable(value: number, coins: number[]): boolean {
    if (value === 0) {
        return true;
    }
    for (const coin of coins) {
        if (coin <= value && isRepresentable(value - coin, coins)) {
            return true;
        }
    }
    return false;
}

function legal(coins: number[], max: number, allowOne: boolean): number[] {
    const result: number[] = [];
    for (let value = allowOne ? 1 : 2; value <= max; value += 1) {
        if (!isRepresentable(value, coins)) {
            result.push(value);
        }
    }
    return result;
}

function winning(coins: number[], max: number, allowOne: boolean): boolean {
    const moves = legal(coins, max, allowOne);
    if (moves.length === 0) {
        return false;
    }
    return moves.some((move) => !winning([...coins, move], max, allowOne));
}

function reference(max: number, allowOne: boolean): { winning: number[]; losing: number[] } {
    const won: number[] = [];
    const lost: number[] = [];
    for (const move of legal([], max, allowOne)) {
        if (winning([move], max, allowOne)) {
            lost.push(move);
        } else {
            won.push(move);
        }
    }
    return { winning: won, losing: lost };
}

describe("Sylver Coinage", () => {
    it("matches the independent game search on small ranges", () => {
        for (const max of [6, 8, 10]) {
            const frames = [...mod.run({ max, allowOne: false })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(max, false);
            expect([...(final?.["winning"] as number[])]).toEqual(expected.winning);
            expect([...(final?.["losing"] as number[])]).toEqual(expected.losing);
        }
    });

    it("naming one is an instant win when allowed", () => {
        const frames = [...mod.run({ max: 8, allowOne: true })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["best"]).toBe(1);
        expect(final?.["winning"]).toContain(1);
        expect(final?.["losing"]).not.toContain(1);
    });

    it("every reported winning opening leaves a losing reply position", () => {
        const max = 8;
        const frames = [...mod.run({ max, allowOne: false })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        for (const move of final?.["winning"] as number[]) {
            // After naming move, it is representable, so it is not sayable again.
            const replyLegal = legal([move], max, false);
            expect(replyLegal).not.toContain(move);
            expect(winning([move], max, false)).toBe(false);
        }
        for (const move of final?.["losing"] as number[]) {
            expect(winning([move], max, false)).toBe(true);
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
