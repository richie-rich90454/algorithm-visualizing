/**
 * best-time-to-buy-sell-stock.ts - Best Time to Buy and Sell Stock
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * With at most one buy followed by one sell, the largest profit is found by a
 * single left-to-right scan: remember the cheapest price seen so far, and at
 * each day consider selling there. No transaction is forced, so the answer is
 * never negative.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - one comparison per day
 *   Space: O(1) - the running minimum and best profit
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are daily prices; the running minimum flashes YELLOW (comparing).
 *   - The buy and sell days of the best trade turn GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The buy day always precedes the sell day.
 *   - The reported profit equals price[sell] minus price[buy].
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(prices: number[], current: number, minDay: number, buyDay: number, sellDay: number): VisualEntity[] {
    return prices.map((price, index) => {
        let state: EntityState = "idle";
        if (index === buyDay || index === sellDay) state = "sorted";
        else if (index === current) state = "comparing";
        else if (index === minDay) state = "active";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(price),
            value: price,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, price },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { prices?: number[] } | null) ?? {};
    const prices: number[] = Array.isArray(task.prices)
        ? task.prices.map((p) => Number(p))
        : [7, 1, 5, 3, 6, 4];
    const n = prices.length;
    let step = 0;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: makeBars(prices.length === 1 ? prices : [0], -1, -1, -1, -1),
            edges: [],
            description: "Fewer than two prices - no profitable buy and sell pair exists.",
            codeLineNumber: 0,
            layout: "array",
            meta: { profit: 0, buyDay: -1, sellDay: -1, minPrice: prices[0] ?? 0 },
        };
        return;
    }

    let minPrice = prices[0] as number;
    let minDay = 0;
    let bestProfit = 0;
    let buyDay = -1;
    let sellDay = -1;

    yield {
        stepNumber: step,
        entities: makeBars(prices, -1, minDay, -1, -1),
        edges: [],
        description: `Scanning ${n} daily prices for the best single buy-then-sell trade.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { profit: 0, buyDay, sellDay, minPrice },
    };
    step += 1;

    for (let day = 1; day < n; day += 1) {
        const price = prices[day] as number;
        const profit = price - minPrice;
        if (profit > bestProfit) {
            bestProfit = profit;
            buyDay = minDay;
            sellDay = day;
        }
        if (price < minPrice) {
            minPrice = price;
            minDay = day;
        }
        yield {
            stepNumber: step,
            entities: makeBars(prices, day, minDay, buyDay, sellDay),
            edges: [],
            description: `Day ${day}: price ${price}, cheapest so far ${minPrice}, best profit ${bestProfit}.`,
            codeLineNumber: profit > 0 ? 3 : 5,
            layout: "array",
            meta: { profit: bestProfit, buyDay, sellDay, minPrice, day },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(prices, -1, minDay, buyDay, sellDay),
        edges: [],
        description:
            buyDay === -1
                ? "Done: no profitable trade exists, so the best profit is 0."
                : `Done: buy at ${prices[buyDay]} on day ${buyDay}, sell at ${prices[sellDay]} on day ${sellDay}, profit ${bestProfit}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { profit: bestProfit, buyDay, sellDay, minPrice },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "For a single transaction you only need to know the cheapest price seen before today. If you had sold at today's price, the profit would be today's price minus that minimum. Track the best of those daily profits and update the minimum whenever a cheaper day appears.",
        invariants: [
            "minPrice is the smallest price among all days strictly before the current day.",
            "bestProfit is the largest profit from any valid buy-then-sell pair seen so far.",
            "buyDay is always less than sellDay whenever a trade is recorded.",
        ],
        correctness:
            "Every optimal sell day has some cheapest earlier buy day, because buying at a higher earlier price can only reduce profit. The scan evaluates exactly the profit for that cheapest-minimum pair on each day and keeps the maximum, so the reported trade is optimal. When no daily profit is positive, no profitable pair exists and the answer is zero.",
        complexityRationale:
            "Each day does a constant amount of work, so the time is O(n); the running minimum and best profit use O(1) space.",
        uses: [
            "A first lesson in one-pass greedy scanning over time series",
            "Computing maximum drawup in a price history",
            "A building block for more complex transaction-limit problems",
        ],
        references: [
            "LeetCode 121, Best Time to Buy and Sell Stock",
            "CLRS, Chapter 14 exercises on aggregate quantities",
        ],
        workedExample:
            "With prices 7, 1, 5, 3, 6, 4, the minimum falls to 1 on day 1. Selling on day 4 at 6 gives profit 5, which beats selling at 5 on day 2 (profit 4), so the answer is buy on day 1 and sell on day 4.",
    },
    id: "best-time-to-buy-sell-stock",
    name: "Best Time to Buy and Sell Stock",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { prices: [7, 1, 5, 3, 6, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "set minPrice to the first price and bestProfit to zero",
        "for each later day from left to right",
        "let profit equal today's price minus minPrice",
        "if profit exceeds bestProfit record this trade",
        "if today's price is below minPrice update the minimum",
        "move to the next day",
        "done: report the best profit and the two days",
    ],
};

export default module;
