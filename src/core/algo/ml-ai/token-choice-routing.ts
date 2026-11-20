/**
 * token-choice-routing.ts - MoE Token-Choice Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a mixture-of-experts layer, token-choice routing lets each token pick the
 * experts with the highest router logits. To balance load, every expert has a
 * capacity: once full, it drops further tokens. Tokens are processed in order,
 * so the first tokens get their preferred experts while overflow tokens are
 * sent to lower-ranked choices or dropped entirely.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * e log e) for n tokens and e experts
 *   Space: O(n * e) for the assignment matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show a token-by-expert grid with a one where a token is routed.
 *   - The highlight moves from the top-k choice phase to capacity enforcement.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RoutingInput {
    logits?: number[][];
    topK?: number;
    capacity?: number;
}

/** Rank experts by logit with a stable tie break on expert index. */
export function rankExperts(logits: number[]): number[] {
    return logits
        .map((score, index) => ({ score, index }))
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map((entry) => entry.index);
}

/** Route tokens to their top-k experts subject to per-expert capacity. */
export function tokenChoiceRoute(
    logits: number[][],
    topK: number,
    capacity: number,
): { assignments: number[][]; counts: number[]; dropped: boolean[]; choices: number[][] } {
    const n = logits.length;
    const e = logits[0]?.length ?? 0;
    const counts = Array.from({ length: e }, () => 0);
    const assignments = Array.from({ length: n }, () => Array.from({ length: e }, () => 0));
    const dropped = Array.from({ length: n }, () => false);
    const choices: number[][] = [];
    for (let token = 0; token < n; token += 1) {
        const ranked = rankExperts(logits[token] ?? []).slice(0, topK);
        choices.push(ranked);
        let placed = 0;
        for (const expert of ranked) {
            if ((counts[expert] ?? 0) < capacity) {
                assignments[token]![expert] = 1;
                counts[expert] = (counts[expert] ?? 0) + 1;
                placed += 1;
            }
        }
        if (placed === 0) dropped[token] = true;
    }
    return { assignments, counts, dropped, choices };
}

function cells(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `c-${index}`,
        type: "cell" as const,
        label: value === 1 ? "1" : "0",
        value,
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RoutingInput | null) ?? {};
    const logits: number[][] = task.logits ?? [
        [3, 1, 0.2],
        [2, 2.5, 0.1],
        [0.5, 3.5, 1],
        [2.2, 0.4, 2.1],
    ];
    const topK = typeof task.topK === "number" ? Math.max(1, task.topK) : 2;
    const capacity = typeof task.capacity === "number" ? Math.max(0, task.capacity) : 2;
    const { assignments, counts, dropped, choices } = tokenChoiceRoute(logits, topK, capacity);
    const n = logits.length;
    const e = logits[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(assignments.flat().map(() => 0), assignments.flat().map(() => "unvisited")),
        edges: [],
        description: `Route ${n} tokens to ${e} experts with top-${topK} choices and capacity ${capacity}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { n, e, topK, capacity, counts: [], dropped: [], assignments: [] },
    };
    step += 1;

    const choiceFlat = Array.from({ length: n }, (_v, token) =>
        Array.from({ length: e }, (_w, expert) => (choices[token] ?? []).includes(expert) ? 1 : 0)).flat();
    yield {
        stepNumber: step,
        entities: cells(choiceFlat, choiceFlat.map((v) => v ? "comparing" : "idle")),
        edges: [],
        description: `Each token ranks experts by router logit and marks its top ${topK} choices.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { n, e, topK, capacity, counts: [], dropped: [], choices },
    };
    step += 1;

    const flat = assignments.flat();
    yield {
        stepNumber: step,
        entities: cells(flat, flat.map((v) => v ? "active" : "idle")),
        edges: [],
        description: `Enforce capacity: a full expert drops additional tokens.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { n, e, topK, capacity, counts, dropped, assignments },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(flat, flat.map((v) => v ? "sorted" : "idle")),
        edges: [],
        description: `Done: expert loads ${counts.join(", ")}; ${dropped.filter(Boolean).length} token(s) dropped.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { n, e, topK, capacity, counts, dropped, assignments, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A mixture-of-experts layer gives each token a choice of specialist networks. The router scores every expert and the token picks its favorites, but without a capacity limit all tokens would pile onto the same popular expert. Capping each expert's load spreads work across the model and keeps computation balanced, at the cost of sometimes dropping overflow tokens.",
        invariants: [
            "A token is only ever assigned to one of its top-k chosen experts.",
            "No expert is assigned more than its capacity.",
            "Tokens are processed in input order, so earlier tokens have priority.",
        ],
        correctness:
            "Ranking experts by logit with a fixed tie break is the brute-force top-k choice. The capacity check is applied before each increment, so counts can never exceed capacity. Because a token is only assigned to experts in its ranked list and each assignment increments exactly one count, the final assignment matrix and counts are consistent with the greedy first-come policy: every token takes its highest ranked choices that still have room, and a token whose choices are all full is marked dropped. This is exactly the defined token-choice routing behavior.",
        complexityRationale:
            "Ranking e experts for each of n tokens costs O(n e log e), and assigning uses O(n top-k). The assignment matrix requires O(n e) storage, with small arrays for counts and drop flags.",
        uses: [
            "Sparse expert routing in large language models",
            "Load-balanced multi-task networks",
            "Conditional computation where each input uses a subset of parameters",
        ],
        references: [
            "Shazeer et al., Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer, ICLR 2017",
            "Switch Transformer routing and capacity factor in feed-forward layers, JMLR 2022",
        ],
        workedExample:
            "Four tokens, three experts, top two and capacity two: token 0 picks experts 0 and 1. Token 1 also picks expert 1 and 0, filling their capacity. When token 2 prefers an already full expert it is routed to its next available choice or dropped, demonstrating how capacity balances load.",
    },
    id: "token-choice-routing",
    name: "MoE Token-Choice Routing",
    category: "ml-ai",
    complexity: { time: "O(n e log e)", space: "O(n e)" },
    defaultInput: {
        logits: [
            [3, 1, 0.2],
            [2, 2.5, 0.1],
            [0.5, 3.5, 1],
            [2.2, 0.4, 2.1],
        ],
        topK: 2,
        capacity: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the token-by-expert router logits, top-k and capacity",
        "for each token rank experts by logit",
        "take the top k experts as the token's choices",
        "assign the token to choices that still have capacity",
        "increment the load of each assigned expert",
        "mark a token dropped if none of its choices had room",
        "done: report assignments, loads and drops",
    ],
};

export default module;
