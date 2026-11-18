/**
 * mixture-of-experts-routing.ts - Top-k Mixture-of-Experts Routing with Capacity
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sparse mixture-of-experts layer sends each token to only a few of its
 * experts. A router computes a probability over experts, the top k are chosen,
 * and a per-expert capacity limits how many tokens each expert accepts. Tokens
 * that arrive at a full expert are dropped. Each chosen expert applies a simple
 * scaling to the token, and the accepted outputs are recombined with the
 * renormalized router probabilities.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * E * d) for routing plus O(n * k * d) for expert application
 *   Space: O(n * E) for scores and assignments plus O(n * d) for outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Router probabilities are a token-by-expert grid.
 *   - Chosen experts are highlighted; dropped assignments are marked.
 *   - Expert capacities, counts, and the combined output live in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    tokens?: number[][];
    routerW?: number[][];
    topK?: number;
    capacityFactor?: number;
}

/** Numerically stable softmax over one row. */
export function softmax(row: number[]): number[] {
    if (row.length === 0) return [];
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((v) => v / total);
}

/** Route tokens to top-k experts under a shared capacity budget. */
export function moeRoute(tokens: number[][], routerW: number[][], topK: number, capacityFactor: number) {
    const E = routerW.length;
    const d = tokens[0]?.length ?? 0;
    const k = Math.max(1, Math.min(E, Math.floor(topK)));
    const capacity = Math.max(1, Math.ceil((capacityFactor * tokens.length * k) / Math.max(1, E)));
    const scores = tokens.map((token) =>
        routerW.map((w) => w.reduce((sum, value, j) => sum + value * (token[j] ?? 0), 0)),
    );
    const probs = scores.map(softmax);
    const counts = Array.from({ length: E }, () => 0);
    const assignments: number[][] = tokens.map(() => []);
    const chosen: number[][] = tokens.map(() => []);
    let dropped = 0;
    for (let i = 0; i < tokens.length; i += 1) {
        const ranked = probs[i]!
            .map((p, e) => ({ p, e }))
            .sort((a, b) => b.p - a.p || a.e - b.e);
        for (let t = 0; t < k; t += 1) {
            const e = ranked[t]?.e ?? 0;
            chosen[i]!.push(e);
            if ((counts[e] ?? 0) < capacity) {
                counts[e] = (counts[e] ?? 0) + 1;
                assignments[i]!.push(e);
            } else {
                dropped += 1;
            }
        }
    }
    return { E, d, k, capacity, scores, probs, chosen, assignments, counts, dropped };
}

/** Apply chosen experts and recombine their outputs with normalized probabilities. */
export function moeForward(tokens: number[][], route: ReturnType<typeof moeRoute>): number[][] {
    return tokens.map((token, i) => {
        const experts = route.assignments[i] ?? [];
        const totalWeight = experts.reduce((sum, e) => sum + (route.probs[i]?.[e] ?? 0), 0);
        const d = token.length;
        return Array.from({ length: d }, (_, j) =>
            experts.reduce((sum, e) => {
                const weight = totalWeight === 0 ? 0 : (route.probs[i]?.[e] ?? 0) / totalWeight;
                return sum + weight * (token[j] ?? 0) * (1 + 0.5 * e);
            }, 0),
        );
    });
}

const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

const padChosen = (chosen: number[][], k: number): number[] =>
    chosen.reduce<number[]>((acc, row) => acc.concat(row, Array.from({ length: k - row.length }, () => -1)), []);

/** The mixture-of-experts routing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const tokens = task.tokens ?? [
        [1, 0],
        [0, 1],
        [1, 1],
    ];
    const routerW = task.routerW ?? [
        [1, 0],
        [0, 1],
        [0.5, 0.5],
    ];
    const topK = typeof task.topK === "number" ? task.topK : 2;
    const capacityFactor = typeof task.capacityFactor === "number" ? task.capacityFactor : 1;
    const route = moeRoute(tokens, routerW, topK, capacityFactor);
    const output = moeForward(tokens, route);
    const n = tokens.length;

    const cells = (focusToken: number): VisualEntity[] => {
        const result: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let e = 0; e < route.E; e += 1) {
                const chosen = (route.chosen[i] ?? []).includes(e);
                const kept = (route.assignments[i] ?? []).includes(e);
                const state: EntityState =
                    i === focusToken && kept ? "active" : i === focusToken && chosen ? "comparing" : chosen ? "visited" : "idle";
                result.push({
                    id: `cell-${i}-${e}`,
                    type: "cell",
                    label: (route.probs[i]?.[e] ?? 0).toFixed(2),
                    value: route.probs[i]?.[e] ?? 0,
                    state,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: i, col: e, dropped: chosen && !kept },
                });
            }
        }
        return result;
    };
    const base = {
        rows: n,
        cols: route.E,
        n,
        E: route.E,
        k: route.k,
        capacity: route.capacity,
        counts: route.counts,
        dropped: route.dropped,
        probs: flatten(route.probs),
        chosen: padChosen(route.chosen, route.k),
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(-1),
        edges: [],
        description: `Route ${n} tokens over ${route.E} experts, top-${route.k}, capacity ${route.capacity} per expert.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "setup", output: flatten(output) },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const chosen = route.chosen[i] ?? [];
        yield {
            stepNumber: step,
            entities: cells(i),
            edges: [],
            description: `Token ${i}: top-${route.k} experts [${chosen.join(", ")}]; ${(route.assignments[i] ?? []).length} accepted, capacity now [${route.counts.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...base, phase: "route", focusToken: i, output: flatten(output) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(-1),
        edges: [],
        description: `Dispatch complete: ${route.dropped} assignment(s) dropped because their expert was full.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...base, phase: "combine", output: flatten(output) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(-1).map((cell) => ({ ...cell, state: "sorted" as EntityState })),
        edges: [],
        description: `Done: combined ${n} outputs with renormalized router weights.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", output: flatten(output), converged: true },
    };
}

/** The mixture-of-experts routing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A dense layer applies every weight to every token. A sparse mixture of experts instead trains several small expert networks and uses a router to pick only a couple of them for each token. A capacity cap keeps any single expert from receiving the whole batch, which is what makes the computation genuinely sparse and scalable.",
        invariants: [
            "Router probabilities for a token are nonnegative and sum to one.",
            "A chosen expert accepts the token only while its count stays below capacity.",
            "Combined weights are the accepted router probabilities renormalized to sum to one per token.",
        ],
        correctness:
            "Ranking probabilities and taking the first k choices implements top-k selection, with index order breaking ties deterministically. The dispatch loop increments a count only when it is below capacity, so no expert ever exceeds capacity and every dropped token is accounted for. Renormalizing the accepted probabilities makes the combine step a convex combination of expert outputs, which is exactly the sparse layer's defined output.",
        complexityRationale:
            "Routing computes E dot products of length d for each of n tokens, O(n * E * d), and sorting the E scores costs O(n * E log E). Applying k experts per token is O(n * k * d). Storage holds the n by E score grid and n output vectors, O(n * E + n * d).",
        uses: [
            "Sparse scaling of very large language models",
            "Conditional computation where different tokens use different subnetworks",
            "Teaching load balancing and capacity drops in expert systems",
        ],
        references: [
            "Shazeer et al., Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer, 2017",
            "Switch Transformers, JMLR 2022",
        ],
        workedExample:
            "With three tokens, three experts, top two, and capacity one, each expert accepts only its first token. Later tokens that also chose that expert are dropped, and their output is formed only from whichever expert still had room, using that expert's probability renormalized to one.",
    },
    id: "mixture-of-experts-routing",
    name: "Mixture-of-Experts Routing",
    category: "ml-ai",
    complexity: { time: "O(n * E * d + n * k * d)", space: "O(n * E + n * d)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        routerW: [
            [1, 0],
            [0, 1],
            [0.5, 0.5],
        ],
        topK: 2,
        capacityFactor: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute router logits as W_r times each token",
        "softmax the logits into expert probabilities",
        "rank experts and select the top k for each token",
        "set capacity from the capacity factor and expert count",
        "dispatch in token order, dropping tokens whose expert is full",
        "apply each accepted expert to its token",
        "combine outputs with renormalized router probabilities",
        "done: report assignments, drops, and combined outputs",
    ],
};

export default module;
