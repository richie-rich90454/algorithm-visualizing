/**
 * dutch-auction.ts - Dutch (Descending Price) Auction
 *
 * The auctioneer starts with a high asking price and lowers it in fixed steps.
 * The first bidder whose valuation reaches the current price accepts and wins
 * the item at that price. The longer a bidder waits, the lower the price falls
 * but the greater the risk that someone else accepts first, so the optimal
 * stopping point balances waiting against losing the item.
 *
 * Time O(L * n) for L price levels and n bidders; space O(L + n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Level {
    price: number;
    accepted: number;
}

function simulate(valuations: number[], startPrice: number, decrement: number): { winner: number; price: number; levels: Level[] } {
    const levels: Level[] = [];
    let price = startPrice;
    let guard = 0;
    while (price > 0 && guard < 24) {
        let accepted = -1;
        for (let i = 0; i < valuations.length; i += 1) {
            if ((valuations[i] ?? 0) >= price - 1e-12) {
                accepted = i;
                break;
            }
        }
        levels.push({ price, accepted });
        if (accepted >= 0) return { winner: accepted, price, levels };
        price -= decrement;
        guard += 1;
    }
    return { winner: -1, price: 0, levels };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { valuations?: number[]; startPrice?: number; decrement?: number } | null) ?? {};
    const valuations = Array.isArray(task.valuations) && task.valuations.length >= 2
        ? task.valuations.map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0))
        : [10, 7, 5, 12];
    const startPrice = typeof task.startPrice === "number" && task.startPrice > 0 ? task.startPrice : 14;
    const decrement = typeof task.decrement === "number" && task.decrement > 0 ? task.decrement : 1;
    const result = simulate(valuations, startPrice, decrement);
    const active = new Set<number>();

    const bars = (): VisualEntity[] =>
        valuations.map((v, i) => ({
            id: `bidder-${i}`,
            type: "bar" as const,
            label: `B${i} val ${v}${i === result.winner ? " WINS" : ""}`,
            value: v,
            state: (i === result.winner ? "sorted" : active.has(i) ? "comparing" : "idle") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { bidder: i, valuation: v, price: result.price, accepted: i === result.winner },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `Dutch auction with ${valuations.length} bidders, asking price ${startPrice} falling by ${decrement} each step.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { valuations: [...valuations], startPrice, decrement, bidders: valuations.length, winner: result.winner },
    };
    step += 1;

    for (const level of result.levels) {
        active.clear();
        if (level.accepted >= 0) active.add(level.accepted);
        yield {
            stepNumber: step,
            entities: bars(),
            edges: [],
            description: level.accepted >= 0
                ? `At price ${level.price.toFixed(2)} bidder ${level.accepted} accepts and stops the auction.`
                : `At price ${level.price.toFixed(2)} no bidder's valuation is high enough, so the price falls again.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { price: level.price, accepted: level.accepted, valuations: [...valuations], decrement, winner: result.winner },
        };
        step += 1;
    }
    active.clear();

    const payoff = result.winner < 0 ? 0 : (valuations[result.winner] ?? 0) - result.price;
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: result.winner < 0
            ? "The price fell to zero without a sale; no bidder accepts a free giveaway in this model."
            : `Bidder ${result.winner} pays ${result.price.toFixed(2)} and earns surplus ${payoff.toFixed(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            winner: result.winner, price: result.price, payoff, valuations: [...valuations],
            pricePath: result.levels.map((l) => l.price), startPrice, decrement,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Dutch auction starts high and counts down until somebody shouts 'mine'. Each bidder watches the falling price and must decide when to accept: wait too long and a rival grabs the item, but accept too early and you pay more than necessary. The first bidder whose value reaches the current price ends the auction at exactly that price.",
        invariants: [
            "The asking price strictly decreases by the fixed decrement each round.",
            "The first bidder with valuation at least the current price wins.",
            "The winner always pays the price at which she accepted.",
        ],
        correctness:
            "The loop examines price levels in descending order and scans bidders in fixed index order at each level. The first level with any willing bidder is therefore the highest price at which a sale can occur, and the first willing bidder at that level is the winner by the stated tie rule. Since valuations are finite and the price falls toward zero, the loop terminates either at a sale or after the last positive level.",
        complexityRationale:
            "At most L price levels are checked and each scans n bidders, giving O(L * n) time; storing the price path and a constant number of arrays uses O(L + n) space.",
        uses: [
            "Flower auctions and perishable-good sales",
            "Dutch-style initial coin offerings and bond tenders",
            "Teaching optimal stopping in descending-price mechanisms",
        ],
        references: [
            "Krishna, Auction Theory (2009), descending auction chapter",
            "Cassady, Auctions and Auctioneering (1967)",
        ],
        workedExample:
            "With valuations 10, 7, 5, 12 and an asking price of 14 falling by one, nobody accepts at 14 or 13. At price 12 the fourth bidder's valuation is reached first in the scan, so she wins and pays 12 for zero surplus; any earlier acceptance would have cost more than her value for the other bidders.",
    },
    id: "dutch-auction",
    name: "Dutch Auction",
    category: "game",
    complexity: { time: "O(L * n)", space: "O(L + n)" },
    defaultInput: { valuations: [10, 7, 5, 12], startPrice: 14, decrement: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read valuations, asking price, and price decrement",
        "start at the initial asking price",
        "scan bidders in order for one who can afford the price",
        "award the item to the first accepting bidder",
        "lower the price by one decrement if nobody accepts",
        "stop when a bidder accepts or the price reaches zero",
        "report the winner, price, and bidder surplus",
    ],
};

export default module;
