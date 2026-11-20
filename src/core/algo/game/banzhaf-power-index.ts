/**
 * banzhaf-power-index.ts - Banzhaf Power Index
 *
 * In a weighted voting game a coalition wins when the sum of its members'
 * weights reaches a quota. A player has a swing in a coalition she does not
 * belong to when that coalition is losing but becomes winning once she joins.
 * The Banzhaf index counts each player's swings and normalizes by the total
 * number of swings, measuring how often a player is pivotal across all
 * coalitions rather than across all joining orders as the Shapley value does.
 *
 * Time O(n * 2^(n-1)); space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function solve(weights: number[], quota: number): { swings: number[]; normalized: number[]; total: number } {
    const n = weights.length;
    const value = (coalition: number[]): number =>
        (coalition.reduce((s, i) => s + (weights[i] ?? 0), 0) >= quota ? 1 : 0);
    const swings = new Array<number>(n).fill(0);

    for (let i = 0; i < n; i += 1) {
        const others = weights.map((_, k) => k).filter((k) => k !== i);
        for (let mask = 0; mask < 2 ** others.length; mask += 1) {
            const coalition = others.filter((_, bit) => (mask & (1 << bit)) !== 0);
            if (value(coalition) === 0 && value([...coalition, i]) === 1) {
                swings[i] = (swings[i] ?? 0) + 1;
            }
        }
    }
    const total = swings.reduce((a, b) => a + b, 0);
    const normalized = swings.map((s) => (total === 0 ? 0 : s / total));
    return { swings, normalized, total };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; quota?: number } | null) ?? {};
    const weights = Array.isArray(task.weights) && task.weights.length >= 2 && task.weights.length <= 6
        ? task.weights.map((w) => (typeof w === "number" && Number.isFinite(w) ? Math.max(0, w) : 0))
        : [4, 3, 2];
    const quota = typeof task.quota === "number" ? task.quota : 5;
    const n = weights.length;
    const result = solve(weights, quota);

    const bars = (highlight: number): VisualEntity[] =>
        weights.map((w, i) => ({
            id: `player-${i}`,
            type: "bar" as const,
            label: `P${i} w${w} ${result.normalized[i]?.toFixed(3) ?? "0.000"}`,
            value: result.normalized[i] ?? 0,
            state: (i === highlight ? "comparing" : (result.swings[i] ?? 0) > 0 ? "sorted" : "idle") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { index: i, weight: w, swings: result.swings[i] ?? 0, normalized: result.normalized[i] ?? 0 },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(-1),
        edges: [],
        description: `Weighted voting game with weights ${weights.join("/")} and quota ${quota}; scanning every coalition for pivotal players.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { weights: [...weights], quota, players: n, swings: [...result.swings], normalized: [...result.normalized], total: result.total },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: bars(i),
            edges: [],
            description: `Player ${i} is pivotal in ${result.swings[i]} coalitions, giving a raw Banzhaf weight of ${result.swings[i]}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { player: i, swings: result.swings[i] ?? 0, normalized: result.normalized[i] ?? 0, total: result.total, weights: [...weights], quota },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(-1),
        edges: [],
        description: `Across ${result.total} total swings the normalized Banzhaf indices are ${result.normalized.map((v) => v.toFixed(3)).join(", ")} and sum to one.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            weights: [...weights], quota, swings: [...result.swings], normalized: [...result.normalized],
            total: result.total, sum: result.normalized.reduce((a, b) => a + b, 0),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A voter is powerful not simply because she has a large weight but because she is often the decisive vote. The Banzhaf index counts every coalition in which a player's arrival flips the outcome from losing to winning. Dividing by the total number of such pivotal moments gives each player's share of decision-making power.",
        invariants: [
            "A swing is a coalition where the player's addition changes losing to winning.",
            "Each player's raw index is the number of coalitions in which she is pivotal.",
            "Normalized indices are nonnegative and sum to one whenever any swing exists.",
        ],
        correctness:
            "For player i the enumeration visits every subset of the other players exactly once, so it counts precisely the coalitions S with value zero and value one after adding i. That is the definition of the non-normalized Banzhaf index. Dividing each count by the sum of all counts preserves relative power and makes the shares sum to one, and a dummy player who is never pivotal receives zero.",
        complexityRationale:
            "Each of the n players considers 2^(n-1) coalitions of the others, and each coalition value is a sum over at most n weights, giving O(n * 2^(n-1)) time with O(n) extra space for the counts.",
        uses: [
            "Measuring voting power in corporate boards and legislatures",
            "Analyzing the influence of shareholders in weighted votes",
            "Comparing power distributions in electoral colleges",
        ],
        references: [
            "Banzhaf, Weighted voting doesn't work: a mathematical analysis (1965)",
            "Osborne and Rubinstein, A Course in Game Theory, cooperative games chapter (1994)",
        ],
        workedExample:
            "With weights 3, 2, 1 and quota 4, the player with weight 3 is pivotal in coalitions with the weight-2 player alone, the weight-1 player alone, or both together, giving three swings. Each smaller player is pivotal only when paired with the weight-3 player, giving one swing each. The normalized indices are therefore three fifths, one fifth, and one fifth.",
    },
    id: "banzhaf-power-index",
    name: "Banzhaf Power Index",
    category: "game",
    complexity: { time: "O(n * 2^(n-1))", space: "O(n)" },
    defaultInput: { weights: [3, 2, 1], quota: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "read the player weights and the winning quota",
        "for each player enumerate coalitions of the others",
        "test whether the coalition is losing",
        "test whether adding the player makes it winning",
        "count one swing when both conditions hold",
        "divide each count by the total number of swings",
        "report the normalized Banzhaf power indices",
    ],
};

export default module;
