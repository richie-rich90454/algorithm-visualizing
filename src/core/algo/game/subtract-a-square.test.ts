/**
 * subtract-a-square.test.ts - Independent recursion check and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./subtract-a-square";
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
    }
}

function referenceWin(n: number): boolean[] {
    const memo = new Map<number, boolean>();
    const solve = (size: number): boolean => {
        if (size === 0) {
            return false;
        }
        const cached = memo.get(size);
        if (cached !== undefined) {
            return cached;
        }
        let value = false;
        for (let k = 1; k * k <= size; k += 1) {
            if (!solve(size - k * k)) {
                value = true;
                break;
            }
        }
        memo.set(size, value);
        return value;
    };
    return Array.from({ length: n + 1 }, (_, i) => solve(i));
}

describe("Subtract-a-Square", () => {
    it("classifies heap sizes up to the default target", () => {
        const input = mod.defaultInput as { n: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = referenceWin(input.n);
        expect(final?.["win"]).toEqual(expected.map((w) => (w ? 1 : 0)));
        const bestMoves = final?.["bestMoves"] as number[];
        expect(bestMoves.length > 0).toBe(expected[input.n]);
        for (const move of bestMoves) {
            expect(move).toBeGreaterThan(0);
            expect(Math.sqrt(move) % 1).toBe(0);
            expect(expected[input.n - move]).toBe(false);
        }
    });

    it("matches independent recursion for many targets", () => {
        for (const n of [1, 2, 3, 5, 8, 13, 20, 31]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const win = frames[frames.length - 1]?.meta["win"] as number[];
            expect(win).toEqual(referenceWin(n).map((w) => (w ? 1 : 0)));
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
