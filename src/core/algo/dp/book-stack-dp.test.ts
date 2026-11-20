/**
 * book-stack-dp.test.ts - Permutation brute force, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./book-stack-dp";
import type { VisualFrame } from "@/types";

/** Overhang of an ordered stack, built top to bottom, from center-of-mass balance. */
function overhang(order: number[]): number {
    let total = 0;
    let reach = 0;
    for (const length of order) {
        reach += (length * length) / (2 * (total + length));
        total += length;
    }
    return reach;
}

/** Independent brute force: try every ordering of every book. */
function brute(lengths: number[]): number {
    let best = 0;
    const used = new Array<boolean>(lengths.length).fill(false);
    const order: number[] = [];
    const visit = (): void => {
        if (order.length === lengths.length) {
            best = Math.max(best, overhang(order.map((i) => lengths[i] ?? 0)));
            return;
        }
        for (let i = 0; i < lengths.length; i += 1) {
            if (used[i]) continue;
            used[i] = true;
            order.push(i);
            visit();
            order.pop();
            used[i] = false;
        }
    };
    visit();
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const lines = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber!).toBeLessThan(lines);
        expect(frame.meta).toBeDefined();
    });
}

function resultFor(lengths: number[]): { answer: number; meta: Record<string, unknown> } {
    const frames = [...mod.run({ lengths })];
    checkFrames(frames);
    const final = frames[frames.length - 1];
    return { answer: Number(final?.meta["answer"]), meta: final?.meta ?? {} };
}

describe("Book Stacking (Bitmask DP)", () => {
    it("matches the permutation brute force on the default input", () => {
        const input = mod.defaultInput as { lengths: number[] };
        expect(resultFor(input.lengths).answer).toBeCloseTo(brute(input.lengths), 9);
    });

    it("agrees with brute force on varied length sets", () => {
        const cases = [
            [1],
            [1, 2],
            [2, 2, 2],
            [1, 2, 3],
            [1, 1, 2, 3],
            [4, 1, 3, 2],
            [1, 2, 3, 4, 5],
        ];
        for (const lengths of cases) {
            expect(resultFor(lengths).answer).toBeCloseTo(brute(lengths), 9);
        }
    });

    it("matches the harmonic result for equal unit books", () => {
        const lengths = [1, 1, 1, 1];
        let harmonic = 0;
        for (let k = 1; k <= 4; k += 1) harmonic += 1 / (2 * k);
        expect(resultFor(lengths).answer).toBeCloseTo(harmonic, 9);
    });

    it("reconstructs an order that attains the reported overhang", () => {
        const lengths = [2, 3, 1, 4];
        const result = resultFor(lengths);
        const order = result.meta["bestOrder"] as number[];
        expect(Array.isArray(order)).toBe(true);
        expect(order.length).toBe(lengths.length);
        expect(overhang(order.map((i) => lengths[i] ?? 0))).toBeCloseTo(result.answer, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
