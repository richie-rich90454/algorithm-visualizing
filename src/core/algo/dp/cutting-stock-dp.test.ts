/**
 * cutting-stock-dp.test.ts - Exhaustive cutting plans, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./cutting-stock-dp";
import type { VisualFrame } from "@/types";

/** Recursively enumerate every ordered cut sequence and return the best revenue. */
function bruteRevenue(length: number, prices: number[]): number {
    const best = (n: number): number => {
        if (n === 0) return 0;
        let answer = -1;
        for (let p = 1; p <= Math.min(n, prices.length - 1); p += 1) {
            answer = Math.max(answer, (prices[p] ?? 0) + best(n - p));
        }
        return answer;
    };
    return best(length);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cutting Stock DP", () => {
    it("matches exhaustive cutting enumeration", () => {
        const cases: Array<{ length: number; prices: number[] }> = [
            { length: 8, prices: [0, 1, 5, 8, 9, 10, 17, 17, 20] },
            { length: 6, prices: [0, 2, 3, 7, 11, 13, 17] },
            { length: 5, prices: [0, 1, 4, 5, 9] },
            { length: 3, prices: [0, 4, 4, 4] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(bruteRevenue(input.length, input.prices));
            const pieces = frames[frames.length - 1]?.meta["pieces"] as number[];
            let sum = 0;
            let value = 0;
            for (const p of pieces) {
                sum += p;
                value += input.prices[p] ?? 0;
            }
            expect(sum).toBe(input.length);
            expect(value).toBe(Number(frames[frames.length - 1]?.meta["answer"]));
        }
    });

    it("handles zero length", () => {
        const frames = [...mod.run({ length: 0, prices: [0, 1] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
