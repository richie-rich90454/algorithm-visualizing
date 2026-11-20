/**
 * best-time-to-buy-sell-stock.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./best-time-to-buy-sell-stock";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function brute(prices: number[]): number {
    let best = 0;
    for (let buy = 0; buy < prices.length; buy += 1) {
        for (let sell = buy + 1; sell < prices.length; sell += 1) {
            best = Math.max(best, (prices[sell] as number) - (prices[buy] as number));
        }
    }
    return best;
}

function resultOf(prices: number[]) {
    const frames = [...mod.run({ prices })];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta ?? {};
    return {
        profit: meta["profit"] as number,
        buyDay: meta["buyDay"] as number,
        sellDay: meta["sellDay"] as number,
    };
}

describe("Best Time to Buy and Sell Stock", () => {
    it("matches brute force and reports a valid trade", () => {
        const cases: number[][] = [
            [7, 1, 5, 3, 6, 4],
            [7, 6, 4, 3, 1],
            [1, 2, 3, 4, 5],
            [3, 3, 3, 3],
            [2, 4, 1],
            [1],
        ];
        for (const prices of cases) {
            const got = resultOf(prices);
            expect(got.profit).toBe(brute(prices));
            if (got.profit > 0) {
                expect(got.buyDay).toBeGreaterThanOrEqual(0);
                expect(got.sellDay).toBeGreaterThan(got.buyDay);
                expect((prices[got.sellDay] as number) - (prices[got.buyDay] as number)).toBe(got.profit);
            }
        }
    });

    it("matches brute force on randomized price series", () => {
        let seed = 4242;
        const rand = () => {
            seed = (1103515245 * seed + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 50; trial += 1) {
            const n = 1 + Math.floor(rand() * 12);
            const prices = Array.from({ length: n }, () => Math.floor(rand() * 50) + 1);
            expect(resultOf(prices).profit).toBe(brute(prices));
        }
    });

    it("handles an empty price series", () => {
        const frames = [...mod.run({ prices: [] })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["profit"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
