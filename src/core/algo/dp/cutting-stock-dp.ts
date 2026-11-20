/**
 * cutting-stock-dp.ts - Cutting Stock / Rod Cutting (DP)
 *
 * Given a rod of length n and a price for every piece length, choose cuts that
 * maximize total revenue. Pieces may be cut repeatedly, so the DP tries every
 * first cut and combines it with the optimal revenue for the remainder.
 *
 * Time: O(n^2). Space: O(n) for the value table and cut choices.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    dp: number[],
    upTo: number,
    final: boolean,
    answerIndex: number,
): VisualEntity[] {
    return dp.map((value, index) => {
        let state: EntityState = "idle";
        if (final) state = index === answerIndex ? "sorted" : "visited";
        else if (index <= upTo) state = index === upTo ? "comparing" : "visited";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, length: index, revenue: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { length?: number; prices?: number[] } | null) ?? {};
    const length = Math.min(20, Math.max(0, Math.floor(typeof task.length === "number" ? task.length : 8)));
    const prices: number[] = Array.isArray(task.prices) && task.prices.length > 0
        ? task.prices.map((p) => Number(p))
        : [0, 1, 5, 8, 9, 10, 17, 17, 20];
    const dp: number[] = new Array<number>(length + 1).fill(0);
    const choice: number[] = new Array<number>(length + 1).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(dp, -1, false, length),
        edges: [],
        description: `Maximizing revenue from a rod of length ${length} using the piece price list [${prices.join(", ")}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { length, answer: 0, dp: [...dp], pieces: [] },
    };
    step += 1;

    for (let a = 1; a <= length; a += 1) {
        let best = -1;
        let bestPiece = 0;
        const limit = Math.min(a, prices.length - 1);
        for (let piece = 1; piece <= limit; piece += 1) {
            const candidate = (prices[piece] ?? 0) + (dp[a - piece] ?? 0);
            if (candidate > best) {
                best = candidate;
                bestPiece = piece;
            }
        }
        dp[a] = best;
        choice[a] = bestPiece;
        yield {
            stepNumber: step,
            entities: makeBars(dp, a, false, length),
            edges: [],
            description: `Length ${a}: best first cut ${bestPiece} gives price ${prices[bestPiece]} plus dp[${a - bestPiece}], total ${best}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { length, answer: 0, dp: [...dp], pieces: [] },
        };
        step += 1;
    }

    const pieces: number[] = [];
    let remaining = length;
    while (remaining > 0) {
        const cut = choice[remaining] ?? 0;
        if (cut <= 0) break;
        pieces.push(cut);
        remaining -= cut;
    }
    yield {
        stepNumber: step,
        entities: makeBars(dp, length, true, length),
        edges: [],
        description: `Optimal revenue is ${dp[length]} achieved by cutting pieces [${pieces.join(", ")}].`,
        codeLineNumber: 6,
        layout: "array",
        meta: { length, answer: dp[length], dp: [...dp], pieces },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A cut removes a first piece and leaves a shorter rod, and the shorter rod is the same problem again. Try every legal first piece, add its price to the best known revenue for the remaining length, and keep the largest total. Because pieces may be repeated, the same price list is reused at every length.",
        invariants: [
            "dp[a] is the maximum revenue obtainable from a rod of length a.",
            "choice[a] records the first cut that attains dp[a].",
            "Every candidate combines one immediate price with an already finalized smaller subproblem.",
        ],
        correctness:
            "Any nonempty cutting plan for length a begins with some first piece p, after which the plan for a-p must itself be optimal or it could be improved. Therefore the optimal revenue is the maximum over p of price[p] plus dp[a-p]. The base case dp[0]=0 is empty, so induction over increasing a proves every dp[a] is optimal, and following the choice pointers reconstructs an optimal set of pieces.",
        complexityRationale:
            "For each of the n lengths the algorithm tries at most n piece sizes, giving O(n^2) time. Two arrays of length n+1 hold the values and choices, so space is O(n).",
        uses: [
            "Maximizing revenue from divisible raw stock in manufacturing",
            "Resource allocation with repeatable chunk sizes",
            "A standard teaching example for unbounded optimal substructure",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 15.1",
            "Gilmore and Gomory, A Linear Programming Approach to the Cutting Stock Problem, 1961",
        ],
        workedExample:
            "With prices 1, 5, 8, 9, 10, 17, 17, 20 for lengths one through eight, the table gives dp[8]=22 by cutting pieces of length two and six, whose prices 5 plus 17 sum to 22.",
    },
    id: "cutting-stock-dp",
    name: "Cutting Stock / Rod Cutting (DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: { length: 8, prices: [0, 1, 5, 8, 9, 10, 17, 17, 20] },
    visualType: "array",
    run,
    pseudocode: [
        "read rod length n and price array price of piece sizes",
        "set dp[0] to zero and all other dp values to zero",
        "for length a from one to n",
        "for piece p from one up to the smaller of a and the largest priced size",
        "candidate is price[p] plus dp[a-p], keep the largest in dp[a]",
        "record the piece p that achieved the maximum",
        "follow recorded pieces from n down to zero and report revenue and cuts",
    ],
};

export default module;
