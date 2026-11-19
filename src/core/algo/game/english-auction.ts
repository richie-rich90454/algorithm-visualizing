/**
 * english-auction.ts - English (Ascending Price) Auction
 *
 * The auctioneer raises the asking price in fixed increments. Bidders drop out
 * once the price exceeds their valuation, and the last remaining bidder wins
 * at the price where the others exited. With a fine price grid the outcome
 * matches the second-price sealed bid auction: the highest bidder wins and
 * pays roughly the second-highest valuation, but the process discovers that
 * price through open ascending competition.
 *
 * Time O(L * n) for L price levels and n bidders; space O(L + n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Round {
    price: number;
    active: number[];
    dropped: number[];
}

function simulate(valuations: number[], increment: number): { winner: number; price: number; rounds: Round[] } {
    const maxVal = Math.max(...valuations);
    let active = valuations.map((_, i) => i);
    let price = 0;
    const rounds: Round[] = [{ price, active: [...active], dropped: [] }];
    let guard = 0;

    while (active.length > 1 && guard < 24) {
        const previous = [...active];
        price += increment;
        active = active.filter((i) => (valuations[i] ?? 0) >= price - 1e-12);
        const dropped = previous.filter((i) => !active.includes(i));
        rounds.push({ price, active: [...active], dropped });
        guard += 1;
        if (active.length === 1) return { winner: active[0] ?? -1, price, rounds };
        if (active.length === 0) {
            // Tied top valuations: lowest index among the last survivors wins
            // at the final price at which all of them were still active.
            const finalPrice = price - increment;
            const winner = previous.reduce(
                (best, i) => ((valuations[i] ?? 0) > (valuations[best] ?? 0) ? i : best),
                previous[0] ?? -1,
            );
            return { winner, price: finalPrice, rounds };
        }
        if (price > maxVal + increment) break;
    }
    return { winner: active[0] ?? -1, price, rounds };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { valuations?: number[]; increment?: number } | null) ?? {};
    const valuations = Array.isArray(task.valuations) && task.valuations.length >= 2
        ? task.valuations.map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0))
        : [10, 7, 5];
    const increment = typeof task.increment === "number" && task.increment > 0 ? task.increment : 1;
    const result = simulate(valuations, increment);

    const bars = (active: number[], dropped: number[], price: number): VisualEntity[] =>
        valuations.map((v, i) => {
            let state: EntityState = "idle";
            if (dropped.includes(i)) state = "error";
            else if (active.includes(i)) state = i === result.winner ? "sorted" : "comparing";
            return {
                id: `bidder-${i}`,
                type: "bar" as const,
                label: `B${i} val ${v}${i === result.winner ? " WINS" : ""}`,
                value: v,
                state,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { bidder: i, valuation: v, price, active: active.includes(i), dropped: dropped.includes(i) },
            };
        });

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(result.rounds[0]?.active ?? [], [], 0),
        edges: [],
        description: `English auction with ${valuations.length} bidders and increment ${increment}; the price starts at zero and rises.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { valuations: [...valuations], increment, bidders: valuations.length, price: 0, winner: result.winner },
    };
    step += 1;

    for (const r of result.rounds.slice(1)) {
        yield {
            stepNumber: step,
            entities: bars(r.active, r.dropped, r.price),
            edges: [],
            description: r.active.length === 1
                ? `At price ${r.price.toFixed(2)} only bidder ${r.active[0]} remains and wins the item.`
                : `At price ${r.price.toFixed(2)} bidder(s) ${r.dropped.join(",")} drop out; ${r.active.length} bidders remain.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { price: r.price, active: [...r.active], dropped: [...r.dropped], valuations: [...valuations], winner: result.winner },
        };
        step += 1;
    }

    const payoff = result.winner < 0 ? 0 : (valuations[result.winner] ?? 0) - result.price;
    yield {
        stepNumber: step,
        entities: bars([result.winner], [], result.price),
        edges: [],
        description: `Bidder ${result.winner} wins at ${result.price.toFixed(2)} with surplus ${payoff.toFixed(2)}, the price discovered by ascending competition.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            winner: result.winner, price: result.price, payoff, valuations: [...valuations],
            pricePath: result.rounds.map((r) => r.price), increment,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In an English auction everyone can see the price climbing. Each bidder stays in until the asking price passes what the item is worth to her, then drops out. When only one bidder is left, she pays the current price, which is just above the value of the last rival, so the process reveals a second-price outcome through an open bidding war.",
        invariants: [
            "A bidder drops out only when the price exceeds her valuation.",
            "Once a bidder drops out she can never reenter.",
            "The winner is the bidder with the highest valuation, with ties broken by index.",
        ],
        correctness:
            "At each price level the filter removes exactly the bidders whose valuation is below the price, so the remaining set is precisely those still willing to pay. The last remaining bidder therefore has the maximum valuation, and the closing price is the first grid level above the second-highest valuation, capped by the winner's own value when top valuations tie. That price is no more than the winner's valuation, so her payoff is nonnegative and the process terminates because the grid eventually exceeds every valuation.",
        complexityRationale:
            "There are at most L ascending price levels and each filters n bidders, for O(L * n) time; storing the round path and bidder arrays uses O(L + n) space.",
        uses: [
            "Traditional art, antique, and livestock auctions",
            "Online ascending auctions with proxy bidding",
            "Teaching the equivalence of English and second-price outcomes",
        ],
        references: [
            "Krishna, Auction Theory (2009), ascending auction chapter",
            "Vickrey, Counterspeculation, Auctions, and Competitive Sealed Tenders (1961)",
        ],
        workedExample:
            "Three bidders value an item at 10, 7, and 5 with increments of one. Bidder 2 exits at price 6 and bidder 1 exits at price 8, leaving bidder 0 alone at price 8, which is just above the second-highest value of 7; the winner earns surplus two.",
    },
    id: "english-auction",
    name: "English Auction",
    category: "game",
    complexity: { time: "O(L * n)", space: "O(L + n)" },
    defaultInput: { valuations: [10, 7, 5], increment: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read bidder valuations and the price increment",
        "start the asking price at zero with all bidders active",
        "raise the price by one increment",
        "drop every bidder whose valuation is below the price",
        "continue while more than one bidder remains",
        "award the item to the last remaining bidder",
        "report the discovered price and winner surplus",
    ],
};

export default module;
