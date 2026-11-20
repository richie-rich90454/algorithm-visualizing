/**
 * minimax-regret.test.ts - Brute force criterion, properties, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./minimax-regret";
import type { VisualFrame } from "@/types";

/** Reference: recompute regrets in a single pass with plain loops. */
function reference(payoffs: number[][]) {
    const rows = payoffs.length;
    const cols = rows > 0 ? payoffs[0].length : 0;
    const best: number[] = [];
    for (let s = 0; s < cols; s += 1) {
        let m = -Infinity;
        for (let a = 0; a < rows; a += 1) m = Math.max(m, payoffs[a][s]);
        best.push(m);
    }
    const worst: number[] = [];
    for (let a = 0; a < rows; a += 1) {
        let w = 0;
        for (let s = 0; s < cols; s += 1) w = Math.max(w, best[s] - payoffs[a][s]);
        worst.push(w);
    }
    const answer = Math.min(...worst);
    const chosen: number[] = [];
    for (let a = 0; a < rows; a += 1) if (worst[a] === answer) chosen.push(a);
    return { best, worst, answer, chosen };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Minimax Regret", () => {
    it("matches an independent regret computation", () => {
        const cases: number[][][] = [
            [[10, 2, -2], [6, 4, 0], [1, 5, 12]],
            [[1, 4], [3, 2]],
            [[0, 0, 0], [5, -1, 3]],
            [[2, 2], [2, 2]],
        ];
        for (const payoffs of cases) {
            const frames = [...mod.run({ payoffs })];
            checkFrames(frames, payoffs.length, payoffs[0].length);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(payoffs);
            expect(final?.["best"]).toEqual(expected.best);
            expect(final?.["worst"]).toEqual(expected.worst);
            expect(final?.["answer"]).toBe(expected.answer);
            expect(final?.["chosen"]).toEqual(expected.chosen);
        }
    });

    it("reports the documented default answer", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["worst"]).toEqual([14, 12, 9]);
        expect(final?.["chosen"]).toEqual([2]);
        expect(final?.["answer"]).toBe(9);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
