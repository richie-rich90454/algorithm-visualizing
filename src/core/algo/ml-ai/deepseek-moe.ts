/**
 * deepseek-moe.ts - DeepSeekMoE Fine-Grained Expert Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DeepSeekMoE splits a Mixture-of-Experts layer into many small, fine-grained
 * experts and keeps a few shared experts that are always active. A router
 * selects the top-k routed experts for each token, respects a per-expert token
 * capacity, and linearly combines the chosen expert outputs with the shared
 * ones. Fine granularity raises expert specialization without growing the
 * number of experts each token evaluates.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n_tokens * n_experts log n_experts + k * d) for routing and combine
 *   Space: O(n_tokens * k + n_experts * d)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The router score matrix is drawn cell by cell.
 *   - Selected routed experts are green, shared experts blue, dropped red.
 *   - Frame meta exposes per-token selections and combined outputs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MoEInput {
    scores?: number[][];
    expertVectors?: number[][];
    topK?: number;
    shared?: number[];
    capacity?: number;
    sharedScale?: number;
}

export interface MoERoute {
    selected: number[];
    dropped: number[];
    shared: number[];
    weights: number[];
}

/** Rank routed experts by score with stable ties and apply per-expert capacity. */
export function routeMoE(
    scores: number[],
    topK: number,
    shared: number[],
    used: number[],
    capacity: number,
): MoERoute {
    const sharedSet = new Set(shared);
    const ranked = scores
        .map((score, index) => ({ score, index }))
        .filter((entry) => !sharedSet.has(entry.index))
        .sort((a, b) => b.score - a.score || a.index - b.index);
    const selected: number[] = [];
    const dropped: number[] = [];
    for (const entry of ranked) {
        if (selected.length >= topK) break;
        if ((used[entry.index] ?? 0) >= capacity) {
            dropped.push(entry.index);
            continue;
        }
        selected.push(entry.index);
    }
    const topScores = selected.map((index) => scores[index] ?? 0);
    const maxScore = Math.max(...topScores, 0);
    const exps = topScores.map((s) => Math.exp(s - maxScore));
    const sum = exps.reduce((a, b) => a + b, 0);
    const weights = exps.map((e) => e / sum);
    return { selected, dropped, shared: [...shared].sort((a, b) => a - b), weights };
}

/** Combine shared and selected routed expert vectors into one output. */
export function combineMoE(
    route: MoERoute,
    expertVectors: number[][],
    sharedScale: number,
): number[] {
    const dim = expertVectors[0]?.length ?? 1;
    const output = new Array<number>(dim).fill(0);
    for (const index of route.shared) {
        const vector = expertVectors[index] ?? [];
        for (let j = 0; j < dim; j += 1) {
            output[j] += sharedScale * (vector[j] ?? 0);
        }
    }
    route.selected.forEach((index, r) => {
        const vector = expertVectors[index] ?? [];
        const weight = route.weights[r] ?? 0;
        for (let j = 0; j < dim; j += 1) {
            output[j] += weight * (vector[j] ?? 0);
        }
    });
    return output;
}

/** Convert route records to plain nested arrays/objects accepted by frame meta. */
function metaRoutes(routes: MoERoute[]): Record<string, number | number[]>[] {
    return routes.map((route) => ({
        selected: [...route.selected],
        dropped: [...route.dropped],
        shared: [...route.shared],
        weights: [...route.weights],
    }));
}

function makeCells(
    scores: number[][],
    routes: MoERoute[],
    token: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const route = routes[Math.max(0, Math.min(token, routes.length - 1))];
    for (let row = 0; row < scores.length; row += 1) {
        for (let col = 0; col < (scores[row]?.length ?? 0); col += 1) {
            const value = scores[row]?.[col] ?? 0;
            let state: EntityState = "idle";
            if (route?.shared.includes(col)) state = "active";
            else if (route?.selected.includes(col)) state = "sorted";
            else if (route?.dropped.includes(col)) state = "error";
            entities.push({
                id: `score-${row}-${col}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, expert: col, token: row },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MoEInput | null) ?? {};
    const scores = (task.scores ?? [
        [0.1, 2.0, 1.5, 0.3, 0.8, 0.2],
        [0.2, 0.4, 1.8, 2.2, 0.1, 0.3],
        [1.0, 0.6, 0.5, 0.2, 2.5, 0.4],
    ]).map((row) => [...row]);
    const expertVectors = (task.expertVectors ?? [
        [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1],
    ]).map((row) => [...row]);
    const topK = Math.max(1, Math.floor(task.topK ?? 2));
    const shared = Array.isArray(task.shared) ? task.shared : [0];
    const capacity = Math.max(0, Math.floor(task.capacity ?? 2));
    const sharedScale = typeof task.sharedScale === "number" ? task.sharedScale : 0.5;
    const used = new Array<number>(expertVectors.length).fill(0);
    const routes: MoERoute[] = [];
    const outputs: number[][] = [];
    for (let token = 0; token < scores.length; token += 1) {
        const route = routeMoE(scores[token] ?? [], topK, shared, used, capacity);
        for (const index of route.selected) {
            used[index] = (used[index] ?? 0) + 1;
        }
        routes.push(route);
        outputs.push(combineMoE(route, expertVectors, sharedScale));
    }

    const rows = scores.length;
    const cols = scores[0]?.length ?? 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(scores, routes, 0),
        edges: [],
        description: `Routing ${rows} tokens across ${cols} experts; top-${topK} routed plus ${shared.length} shared expert(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols, topK, shared, capacity, routes: metaRoutes(routes), outputs, used },
    };
    step += 1;

    for (let token = 0; token < scores.length; token += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(scores, routes, token),
            edges: [],
            description: `Token ${token}: chose routed experts ${(routes[token]?.selected ?? []).join(",")} and dropped ${(routes[token]?.dropped ?? []).length} at capacity; output ${(outputs[token] ?? []).join(",")}.`,
            codeLineNumber: token === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows, cols, topK, shared, capacity, routes: metaRoutes(routes), outputs, used, token },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(scores, routes, scores.length - 1),
        edges: [],
        description: `Routed all ${rows} tokens; expert load counts ${used.join(",")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows, cols, topK, shared, capacity, routes: metaRoutes(routes), outputs, used },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A large Mixture-of-Experts layer wastes capacity when each expert is broad. DeepSeekMoE uses many narrow experts so combinations are more expressive, and always activates a small shared set for common knowledge. A router picks only a few fine-grained experts per token, so compute stays small even as the expert count grows.",
        invariants: [
            "Shared experts are selected for every token regardless of router scores.",
            "A routed expert is never selected more than the capacity allows across the batch.",
            "Routing weights are nonnegative and sum to one over the selected routed experts.",
        ],
        correctness:
            "Sorting router scores with index tie-breaking is a brute-force selection of the top-k routed experts. Capacity is enforced by rejecting any expert whose running count already reached the limit before it can be chosen. The softmax over the chosen scores is computed with a shifted maximum for numerical stability, so weights are positive and normalized, and the final vector is exactly the weighted sum of the selected and shared expert outputs.",
        complexityRationale:
            "Ranking the experts for one token costs O(n_experts log n_experts) and combining k plus shared vectors costs O((k + s) d). Only the selected indices and the running load counts are stored beyond the score matrix.",
        uses: [
            "Sparse mixture-of-experts language models with thousands of experts",
            "Conditional computation in large neural networks",
            "Multi-task models sharing a common expert backbone",
        ],
        references: [
            "Dai et al., DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models, ACL 2024",
            "Shazeer et al., Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer, ICLR 2017",
        ],
        workedExample:
            "With scores [0.1, 2.0, 1.5, 0.3] for one token, topK=2 and shared expert 0, the router picks experts 1 and 2. Their softmax weights over scores 2.0 and 1.5 are about 0.622 and 0.378, and the output adds half of shared expert 0's vector plus those weighted routed vectors.",
    },
    id: "deepseek-moe",
    name: "DeepSeekMoE Fine-Grained Expert Routing",
    category: "ml-ai",
    complexity: { time: "O(T * E log E + k * d)", space: "O(T * k + E * d)" },
    defaultInput: {
        scores: [
            [0.1, 2.0, 1.5, 0.3, 0.8, 0.2],
            [0.2, 0.4, 1.8, 2.2, 0.1, 0.3],
            [1.0, 0.6, 0.5, 0.2, 2.5, 0.4],
        ],
        expertVectors: [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1]],
        topK: 2,
        shared: [0],
        capacity: 2,
        sharedScale: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the per-expert token load counters to zero",
        "for each token in the batch",
        "sort routed experts by descending router score with index tie-break",
        "skip any expert whose load already reached capacity",
        "take the first k remaining experts as selected",
        "apply a softmax over their scores to get routing weights",
        "add the shared expert vectors and the weighted routed vectors",
        "done: return each token's combined output",
    ],
};

export default module;
