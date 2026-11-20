/**
 * vickrey-auction.ts - Vickrey Second-Price Auction
 *
 * In a sealed-bid second-price auction the highest bidder wins but pays the
 * second-highest bid. Because the price does not depend on the winner's own
 * bid, bidding one's true valuation is a dominant strategy: winning at a price
 * below the valuation yields positive surplus and winning above it yields
 * negative surplus, regardless of what others bid.
 *
 * Time O(n log n) to sort bids; space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function winnerOf(bids: number[]): { winner: number; payment: number } {
    const order = bids.map((b, i) => ({ b, i })).sort((x, y) => y.b - x.b || x.i - y.i);
    return { winner: order[0]?.i ?? -1, payment: order[1]?.b ?? 0 };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { valuations?: number[]; bids?: number[] } | null) ?? {};
    const valuations = Array.isArray(task.valuations) && task.valuations.length >= 2
        ? task.valuations.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0))
        : [10, 7, 5];
    const bids = Array.isArray(task.bids) && task.bids.length === valuations.length
        ? task.bids.map((b) => (typeof b === "number" && Number.isFinite(b) ? b : 0))
        : [...valuations];

    const bars = (winner: number): VisualEntity[] =>
        valuations.map((v, i) => ({
            id: `bidder-${i}`,
            type: "bar" as const,
            label: `B${i} bid ${bids[i]} val ${v}`,
            value: bids[i] ?? 0,
            state: (i === winner ? "sorted" : "idle") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { index: i, bid: bids[i] ?? 0, valuation: v },
        }));

    let step = 0;
    yield {
        stepNumber: step, entities: bars(-1), edges: [],
        description: `Second-price auction with ${valuations.length} bidders; sealed bids are ${bids.join(", ")}.`,
        codeLineNumber: 0, layout: "array",
        meta: { bids: [...bids], valuations: [...valuations], bidders: valuations.length },
    };
    step += 1;

    const ranked = bids.map((b, i) => ({ b, i })).sort((x, y) => y.b - x.b || x.i - y.i);
    for (let k = 0; k < ranked.length; k += 1) {
        const entry = ranked[k];
        if (!entry) continue;
        yield {
            stepNumber: step, entities: bars(entry.i), edges: [],
            description: `Ranking bids: position ${k + 1} is bidder ${entry.i} with bid ${entry.b}.`,
            codeLineNumber: 2, layout: "array",
            meta: { rank: k + 1, bidder: entry.i, bid: entry.b, bids: [...bids] },
        };
        step += 1;
    }

    const { winner, payment } = winnerOf(bids);
    const utility = winner < 0 ? 0 : (valuations[winner] ?? 0) - payment;
    for (let i = 0; i < bids.length; i += 1) {
        const truthful = winnerOf(bids.map((b, k) => (k === i ? (valuations[i] ?? 0) : b)));
        const truthfulUtility = truthful.winner === i ? (valuations[i] ?? 0) - truthful.payment : 0;
        const currentUtility = winner === i ? (valuations[i] ?? 0) - payment : 0;
        yield {
            stepNumber: step, entities: bars(winner), edges: [],
            description: `Bidder ${i}: current surplus ${currentUtility}, surplus when bidding true value ${truthfulUtility}; truthful bidding is never worse.`,
            codeLineNumber: 4, layout: "array",
            meta: { bidder: i, currentUtility, truthfulUtility, winner, payment, bids: [...bids] },
        };
        step += 1;
    }

    yield {
        stepNumber: step, entities: bars(winner), edges: [],
        description: `Bidder ${winner} wins at the second price ${payment} and earns surplus ${utility}.`,
        codeLineNumber: 6, layout: "array",
        meta: { winner, payment, utility, bids: [...bids], valuations: [...valuations], optimal: winner },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The winner of a second-price auction pays the loser's highest bid, so raising your own bid can change whether you win but not the price you pay if you win. That removes the usual tension between bidding high to win and bidding low to pay less, making your true valuation the best bid whatever everyone else does.",
        invariants: [
            "The winner is the bidder with the highest sealed bid.",
            "The payment is the second-highest bid, independent of the winner's bid.",
            "A losing bidder pays nothing and receives zero surplus.",
        ],
        correctness:
            "Fix the other bids and let p be their highest bid. Bidding above p wins and gives surplus valuation minus p, bidding below p loses for zero surplus, and bidding exactly p is a tie. If valuation exceeds p, winning is beneficial so bidding at least the truthful value is optimal; if valuation is below p, losing is better. In both cases bidding the true valuation is a weakly dominant strategy.",
        complexityRationale:
            "Finding the two largest bids requires sorting n values, which takes O(n log n) time, or one linear pass for O(n); the bid and valuation arrays use O(n) space.",
        uses: [
            "Online advertising slot auctions",
            "Government procurement and spectrum license sales",
            "Auction theory teaching examples of dominant strategies",
        ],
        references: [
            "Vickrey, Counterspeculation, Auctions, and Competitive Sealed Tenders (1961)",
            "Krishna, Auction Theory (2009)",
        ],
        workedExample:
            "With valuations 10, 7, 5 and bids 9, 8, 4, bidder 0 wins with the top bid of 9 but pays the second bid of 8. Her surplus is 10 minus 8, or 2, and bidding her true value 10 would win at the same price, so no deviation improves her outcome.",
    },
    id: "vickrey-auction",
    name: "Vickrey Second-Price Auction",
    category: "game",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { valuations: [10, 7, 5], bids: [9, 8, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "collect each bidder's sealed bid and private valuation",
        "sort the bids from highest to lowest with tie breaking by index",
        "award the item to the highest bidder",
        "set the payment to the second-highest bid",
        "compute each bidder's surplus from the allocation",
        "compare surplus with the truthful bid for each bidder",
        "report the winner, payment, and resulting surplus",
    ],
};

export default module;
