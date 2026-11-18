/**
 * switch-transformer-routing.ts - Switch Transformer Routing (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Switch layer sends each token to exactly one expert. A linear router
 * produces a logit per expert, softmax turns those logits into probabilities,
 * and the top expert receives the token unless its capacity is full. The
 * auxiliary load-balancing loss rewards spreading tokens evenly across
 * experts. This module implements the routing and that loss exactly on a
 * small deterministic batch.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * E * d) for n tokens, E experts, input dimension d
 *   Space: O(n * E) for logits and probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells are tokens by experts: logits, then probabilities, then the
 *     chosen expert (one per token, with dropped tokens marked).
 *   - Load fractions and the auxiliary loss are reported in metadata.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SwitchInput {
    tokens?: number[][];
    experts?: number;
    capacityFactor?: number;
    seed?: number;
}

function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function cells(matrix: number[][], state: EntityState): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: Number.isInteger(value) ? String(value) : value.toFixed(3),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SwitchInput | null) ?? {};
    const tokens = Array.isArray(task.tokens) && task.tokens.length > 0
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
              [2, 0],
              [0, 2],
              [1, 2],
          ];
    const n = tokens.length;
    const d = tokens[0]?.length ?? 2;
    const E = Math.max(1, typeof task.experts === "number" ? Math.trunc(task.experts) : 3);
    const capacityFactor = typeof task.capacityFactor === "number" && task.capacityFactor > 0 ? task.capacityFactor : 1;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 13;
    const next = weightStream(seed);
    const W = Array.from({ length: d }, () => Array.from({ length: E }, next));

    const logits = tokens.map((row) => Array.from({ length: E }, (_u, e) => row.reduce((s, x, k) => s + x * (W[k]?.[e] ?? 0), 0)));
    const probs = logits.map((row) => {
        const max = Math.max(...row);
        const exp = row.map((v) => Math.exp(v - max));
        const denom = exp.reduce((a, b) => a + b, 0);
        return exp.map((v) => v / denom);
    });
    const capacity = Math.max(1, Math.ceil((n * capacityFactor) / E));
    const counts = Array(E).fill(0) as number[];
    const chosen: number[] = [];
    const dropped: boolean[] = [];
    for (let i = 0; i < n; i += 1) {
        const row = probs[i] ?? [];
        let best = 0;
        for (let e = 1; e < E; e += 1) {
            if ((row[e] ?? 0) > (row[best] ?? 0)) best = e;
        }
        chosen.push(best);
        if ((counts[best] ?? 0) >= capacity) {
            dropped.push(true);
        } else {
            counts[best] = (counts[best] ?? 0) + 1;
            dropped.push(false);
        }
    }
    const tokenFraction = counts.map((c) => c / n);
    const probFraction = Array.from({ length: E }, (_u, e) =>
        probs.reduce((s, row) => s + (row[e] ?? 0), 0) / n,
    );
    const auxLoss = E * tokenFraction.reduce((s, f, e) => s + f * (probFraction[e] ?? 0), 0);
    const assignment = Array.from({ length: n }, (_u, i) =>
        Array.from({ length: E }, (_v, e) => {
            if (dropped[i]) return -1;
            return e === chosen[i] ? 1 : 0;
        }),
    );

    const base = { rows: n, cols: E, n, E, capacity, capacityFactor };
    yield {
        stepNumber: 0,
        entities: cells(logits, "comparing"),
        edges: [],
        description: `Router logits for ${n} tokens over ${E} experts, with capacity ${capacity} per expert.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "logits", logits: logits.flat(), weights: JSON.stringify(W) },
    };
    yield {
        stepNumber: 1,
        entities: cells(probs, "active"),
        edges: [],
        description: `Softmax turns each logit row into probabilities that sum to one.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { ...base, phase: "probabilities", probs: probs.flat(), logits: logits.flat() },
    };
    yield {
        stepNumber: 2,
        entities: cells(assignment, "sorted"),
        edges: [],
        description: `Top-1 dispatch: chosen experts ${chosen.join(", ")}; ${dropped.filter(Boolean).length} token(s) dropped. Load-balancing loss ${auxLoss.toFixed(3)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            ...base,
            phase: "dispatch",
            chosen,
            dropped: dropped.map((d) => (d ? 1 : 0)),
            counts,
            tokenFraction,
            probFraction,
            auxLoss,
            assignment: assignment.flat(),
            probs: probs.flat(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Switch Transformer replaces a dense feed-forward block with a collection of smaller expert blocks and a router that picks one expert per token. The router scores every expert with a linear layer, and the highest probability expert processes the token. A capacity limit prevents a single expert from receiving everything, and an auxiliary loss nudges the router toward using all experts equally.",
        invariants: [
            "Router probabilities for each token are a softmax and sum to one.",
            "Each token is dispatched to at most one expert, and no expert receives more than its capacity.",
            "The auxiliary loss equals the number of experts times the sum over experts of the dispatched fraction times the mean router probability.",
        ],
        correctness:
            "The router logits are linear functions of the token with fixed weights, and the softmax denominator normalizes each row, so probabilities sum to one. Picking the largest probability gives the top-1 expert; the counter enforces capacity and records any dropped tokens. The load-balancing loss is computed by summing, for each expert, the product of the fraction of tokens sent there and the average probability assigned there, then scaling by the number of experts, which is exactly the Switch auxiliary loss.",
        complexityRationale:
            "Computing logits is a matrix-vector product of O(n times E times d), softmax and dispatch are O(n times E), and the auxiliary loss is O(n times E). Storing logits, probabilities, and the assignment uses O(n times E) space.",
        uses: [
            "Scaling language models to more parameters without proportional compute",
            "Multi-task models where experts specialize in different inputs",
            "Conditional computation in large neural networks",
        ],
        references: [
            "Fedus, Zoph and Shazeer, Switch Transformers: Scaling to Trillion Parameter Models, 2021",
            "Shazeer et al., Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer, 2017",
        ],
        workedExample:
            "With six tokens, three experts, and capacity two, suppose token probabilities are (0.7, 0.2, 0.1) and token one also prefers expert zero. Expert zero can take two tokens; a third token choosing it is dropped. If token fractions are (0.33, 0.33, 0.33) and mean probabilities are near (0.34, 0.33, 0.33), the auxiliary loss is close to its ideal minimum of one.",
    },
    id: "switch-transformer-routing",
    name: "Switch Transformer Routing (Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(n * E * d)", space: "O(n * E)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
            [2, 0],
            [0, 2],
            [1, 2],
        ],
        experts: 3,
        capacityFactor: 1,
        seed: 13,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize router weights for every expert",
        "compute a logit for each token and expert",
        "softmax the logits of each token into probabilities",
        "pick the top probability expert as the chosen expert",
        "dispatch the token unless that expert is at capacity",
        "accumulate the fraction of tokens sent to each expert",
        "accumulate the mean router probability for each expert",
        "compute the auxiliary load-balancing loss",
        "done: report assignments, drops, and the auxiliary loss",
    ],
};

export default module;
