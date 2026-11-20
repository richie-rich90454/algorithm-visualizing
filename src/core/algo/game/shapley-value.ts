/**
 * shapley-value.ts - Shapley Value
 *
 * The Shapley value divides a coalition's total payoff among its players by
 * averaging each player's marginal contribution over every possible order in
 * which the coalition can form. It is the unique division satisfying
 * efficiency, symmetry, dummy, and additivity, which makes it the standard
 * fair allocation rule in cooperative game theory.
 *
 * Time O(n! * n) by permutation enumeration; space O(n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function permutations(arr: number[]): number[][] {
    if (arr.length <= 1) return [arr];
    const out: number[][] = [];
    arr.forEach((v, i) => {
        const rest = arr.slice(0, i).concat(arr.slice(i + 1));
        for (const p of permutations(rest)) out.push([v, ...p]);
    });
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; quota?: number } | null) ?? {};
    const weights = Array.isArray(task.weights) && task.weights.length >= 1 && task.weights.length <= 5
        ? task.weights.map((w) => (typeof w === "number" && Number.isFinite(w) ? w : 0))
        : [4, 3, 2];
    const quota = typeof task.quota === "number" ? task.quota : 5;
    const n = weights.length;
    const value = (coalition: number[]): number =>
        coalition.reduce((sum, i) => sum + (weights[i] ?? 0), 0) >= quota ? 1 : 0;
    const totalValue = value(weights.map((_, i) => i));
    const shapley = new Array<number>(n).fill(0);
    const orders = permutations(weights.map((_, i) => i));

    const bars = (added: number, marginal: number): VisualEntity[] =>
        weights.map((w, i) => ({
            id: `player-${i}`,
            type: "bar" as const,
            label: `P${i} ${shapley[i]?.toFixed(2) ?? "0.00"}`,
            value: shapley[i] ?? 0,
            state: (i === added ? "comparing" : shapley[i] ? "sorted" : "idle") as EntityState,
            x: 0, y: 0, width: 0, height: 0,
            metadata: { index: i, weight: w, marginal: i === added ? marginal : 0 },
        }));

    let step = 0;
    yield {
        stepNumber: step, entities: bars(-1, 0), edges: [],
        description: `Shapley value for ${n} weighted voters with quota ${quota}; all ${orders.length} coalitions orders are averaged.`,
        codeLineNumber: 0, layout: "array",
        meta: { weights: [...weights], quota, players: n, permutations: orders.length, shapley: [...shapley], totalValue },
    };
    step += 1;

    for (const order of orders) {
        const coalition: number[] = [];
        for (const player of order) {
            const before = value(coalition);
            coalition.push(player);
            const after = value(coalition);
            const marginal = after - before;
            shapley[player] = (shapley[player] ?? 0) + marginal / orders.length;
            yield {
                stepNumber: step, entities: bars(player, marginal), edges: [],
                description: `Order [${order.join(",")}]: adding player ${player} changes coalition value by ${marginal}.`,
                codeLineNumber: 3, layout: "array",
                meta: { order: [...order], player, before, after, marginal, coalition: [...coalition], shapley: [...shapley], permutations: orders.length },
            };
            step += 1;
        }
    }

    const sum = shapley.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step, entities: bars(-1, 0), edges: [],
        description: `Shapley values ${shapley.map((x) => x.toFixed(3)).join(", ")} sum to ${sum.toFixed(3)} = the grand coalition value.`,
        codeLineNumber: 6, layout: "array",
        meta: { shapley: [...shapley], sum, totalValue, weights: [...weights], quota },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To split a joint payoff fairly, imagine the coalition forming one player at a time in every possible order and credit each player with the extra value she brings when she joins. Averaging those marginal contributions over all orders gives every player her Shapley value, which rewards players who are pivotal in many coalitions.",
        invariants: [
            "A marginal contribution is the coalition value after joining minus before joining.",
            "Every coalition order is weighted equally by one over n factorial.",
            "The Shapley values sum to the value of the grand coalition.",
        ],
        correctness:
            "Averaging the marginal contributions over all permutations is exactly the Shapley formula. This allocation is efficient because along every order the marginal contributions telescope to the grand coalition value; it is symmetric, gives dummies zero, and is additive, and those four axioms determine a unique value.",
        complexityRationale:
            "There are n factorial orders, each adding n players and evaluating the coalition, so the direct enumeration takes O(n! * n) time and O(n) space beyond the input; the subset formula can reduce the factorial for large n.",
        uses: [
            "Fair cost and profit sharing among collaborating agents",
            "Attribution of model performance to features or data sources",
            "Power indices in weighted voting bodies",
        ],
        references: [
            "Shapley, A Value for n-Person Games (1953)",
            "Osborne and Rubinstein, A Course in Game Theory, cooperative games chapter (1994)",
        ],
        workedExample:
            "With voters weighing 4, 3, and 2 and quota 5, the grand coalition wins with value 1. Across the six joining orders, the first voter is pivotal in four orders and the others in one each, giving Shapley values near 2/3, 1/6, and 1/6.",
    },
    id: "shapley-value",
    name: "Shapley Value",
    category: "game",
    complexity: { time: "O(n! * n)", space: "O(n)" },
    defaultInput: { weights: [4, 3, 2], quota: 5 },
    visualType: "array",
    run,
    pseudocode: [
        "define the coalition value as one when weight meets the quota",
        "enumerate every order in which players can join",
        "start an empty coalition for each order",
        "record the value before and after adding each player",
        "add the marginal contribution divided by the order count",
        "repeat across all players and all orders",
        "report the average marginal contributions as Shapley values",
    ],
};

export default module;
