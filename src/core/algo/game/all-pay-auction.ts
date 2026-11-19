/**
 * all-pay-auction.ts - All-Pay Auction
 *
 * Every bidder pays the amount she bids, whether or not she wins, and the
 * highest bidder receives the prize. A bidder's payoff is therefore her own
 * valuation of the prize minus her bid if she wins, and minus her bid if she
 * loses. Because losing is costly, there is no dominant pure bid: raising a
 * bid improves the chance of winning but lowers the payoff whenever the prize
 * is captured. In the symmetric equilibrium with identical valuations, bids
 * are drawn from the CDF F(b) = (b / V)^(1/(n-1)) on [0, V].
 *
 * Time O(n) for the outcome and O(n * R) for a deviation scan of R bids;
 * space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Outcome {
    winner: number;
    payments: number[];
    payoffs: number[];
    revenue: number;
    totalSurplus: number;
}

function outcomeOf(valuations: number[], bids: number[]): Outcome {
    let winner = 0;
    for (let i = 1; i < bids.length; i += 1) {
        if ((bids[i] ?? 0) > (bids[winner] ?? 0)) winner = i;
    }
    const payments = [...bids];
    const payoffs = bids.map((b, i) => (i === winner ? (valuations[i] ?? 0) : 0) - b);
    const revenue = bids.reduce((a, b) => a + b, 0);
    const totalSurplus = payoffs.reduce((a, b) => a + b, 0);
    return { winner, payments, payoffs, revenue, totalSurplus };
}

function payoffFromBid(valuations: number[], bids: number[], bidder: number, bid: number): number {
    const all = bids.map((b, i) => (i === bidder ? bid : b));
    let winner = 0;
    for (let i = 1; i < all.length; i += 1) {
        if ((all[i] ?? 0) > (all[winner] ?? 0)) winner = i;
    }
    return winner === bidder ? (valuations[bidder] ?? 0) - bid : -bid;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { valuations?: number[]; bids?: number[] } | null) ?? {};
    const valuations = Array.isArray(task.valuations) && task.valuations.length >= 2
        ? task.valuations.map((v) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0))
        : [10, 10];
    const bids = Array.isArray(task.bids) && task.bids.length === valuations.length
        ? task.bids.map((b) => (typeof b === "number" && Number.isFinite(b) ? Math.max(0, b) : 0))
        : [...valuations].map((v) => v * 0.7);
    const n = valuations.length;
    const result = outcomeOf(valuations, bids);
    const active = new Set<number>();

    const bars = (): VisualEntity[] => {
        const out: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            out.push({
                id: `val-${i}`,
                type: "bar",
                label: `V${i}=${(valuations[i] ?? 0).toFixed(1)}`,
                value: valuations[i] ?? 0,
                state: (active.has(i) ? "comparing" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { kind: "valuation", bidder: i },
            });
            out.push({
                id: `bid-${i}`,
                type: "bar",
                label: `b${i}=${(bids[i] ?? 0).toFixed(1)} pay ${(result.payoffs[i] ?? 0).toFixed(1)}`,
                value: bids[i] ?? 0,
                state: (i === result.winner ? "sorted" : active.has(i) ? "comparing" : "idle") as EntityState,
                x: 0, y: 0, width: 0, height: 0,
                metadata: { kind: "bid", bidder: i, payment: bids[i] ?? 0, payoff: result.payoffs[i] ?? 0 },
            });
        }
        return out;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `All-pay auction with ${n} bidders; valuations ${valuations.join("/")} and bids ${bids.join("/")}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { valuations: [...valuations], bids: [...bids], bidders: n, winner: result.winner },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        active.clear();
        active.add(i);
        yield {
            stepNumber: step,
            entities: bars(),
            edges: [],
            description: `Bidder ${i} pays the full bid ${(bids[i] ?? 0).toFixed(2)} and earns payoff ${(result.payoffs[i] ?? 0).toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                bidder: i, payment: result.payments[i] ?? 0, payoff: result.payoffs[i] ?? 0,
                winner: result.winner, revenue: result.revenue,
            },
        };
        step += 1;
    }
    active.clear();

    const maxVal = Math.max(1, ...valuations);
    let bestBid = bids[0] ?? 0;
    let bestPayoff = payoffFromBid(valuations, bids, 0, bestBid);
    for (let b = 0; b <= maxVal + 2; b += 1) {
        const payoff = payoffFromBid(valuations, bids, 0, b);
        if (payoff > bestPayoff + 1e-12) {
            bestPayoff = payoff;
            bestBid = b;
        }
    }
    const currentPayoff = payoffFromBid(valuations, bids, 0, bids[0] ?? 0);
    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `Deviation scan for bidder 0: best bid ${bestBid.toFixed(1)} yields ${bestPayoff.toFixed(2)} versus ${currentPayoff.toFixed(2)} now, so no single pure bid dominates.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { bidder: 0, bestBid, bestPayoff, currentPayoff, winner: result.winner },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(),
        edges: [],
        description: `Bidder ${result.winner} wins the prize; total payments ${result.revenue.toFixed(2)} equal the sum of all bids and payoffs sum to ${result.totalSurplus.toFixed(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            winner: result.winner, payments: [...result.payments], payoffs: [...result.payoffs],
            revenue: result.revenue, totalSurplus: result.totalSurplus, valuations: [...valuations],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An all-pay auction charges every participant the amount she bid, win or lose. The prize goes to the highest bidder, so a larger bid raises the chance of winning but is paid in every case. This tradeoff means there is no simple rule like 'bid your value'; optimal play is typically randomized.",
        invariants: [
            "Every bidder's payment equals her submitted bid.",
            "The highest bidder is awarded the single prize.",
            "The sum of all payoffs equals the winner's valuation minus total revenue.",
        ],
        correctness:
            "The winner is the index of the maximum bid because the prize is awarded to the highest offer and ties break to the lowest index. Each payoff subtracts the bid unconditionally and adds the winner's own valuation only for the winner, so summing payoffs gives the winner's valuation minus the sum of all bids. The deviation scan evaluates a grid of alternative bids against fixed opponent bids, and the best scanned payoff is never below the current payoff because the grid includes the current bid.",
        complexityRationale:
            "Finding the maximum bid and computing payments and payoffs each take O(n) time. The optional deviation scan tries R candidate bids, each comparing against n opponents, for O(n * R) time and O(n) space.",
        uses: [
            "Lobbying contests and rent-seeking models",
            "Crowdfunding campaigns where all contributors pay",
            "Tournament and contest theory in economics",
        ],
        references: [
            "Krishna, Auction Theory (2009), all-pay auction chapter",
            "Hillman and Samet, Effective rent seeking and dominance (1987)",
        ],
        workedExample:
            "Two bidders each value a prize at 10 and bid 7 and 4. Bidder 0 wins, everyone pays their bid, and revenue is 11. Payoffs are 10 minus 7 equals 3 and minus 4 equals negative 4, which sum to 10 minus 11 equals negative 1.",
    },
    id: "all-pay-auction",
    name: "All-Pay Auction",
    category: "game",
    complexity: { time: "O(n * R)", space: "O(n)" },
    defaultInput: { valuations: [10, 10], bids: [7, 4] },
    visualType: "array",
    run,
    pseudocode: [
        "read each bidder's private valuation and bid",
        "find the highest bid and award the prize to that bidder",
        "charge every bidder the full amount of her bid",
        "compute payoff as prize value minus bid for the winner",
        "compute payoff as negative bid for every loser",
        "scan alternative bids to show no pure bid dominates",
        "report the winner, revenue, and payoff vector",
    ],
};

export default module;
