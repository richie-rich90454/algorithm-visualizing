/**
 * expert-choice-routing.ts - Expert-Choice Routing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In expert-choice routing each expert selects the top-k tokens it wants,
 * instead of each token choosing its top experts. Because every expert takes
 * exactly k tokens, the load is perfectly balanced by construction and no
 * auxiliary load-balancing loss is needed. Each selected token is processed by
 * every expert that chose it.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the exact routing core: a token-by-expert affinity matrix and a fixed
 * per-expert capacity. It does not run the expert networks themselves, train
 * the router, or model a distributed all-to-all transfer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E * n log n) for E experts sorting n token affinities
 *   Space: O(E * k) for the chosen token assignments
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The affinity matrix has one row per token and one column per expert.
 *   - Each expert's chosen cells turn green as that expert is processed.
 *   - The frame meta exposes the assignment and the resulting token load.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RoutingInput {
    affinity?: number[][];
    k?: number;
}

/** Choose the k tokens with highest affinity for one expert; ties favor lower index. */
export function chooseTokens(affinity: number[][], expert: number, k: number): number[] {
    const n = affinity.length;
    const order = Array.from({ length: n }, (_v, i) => i);
    order.sort((a, b) => {
        const diff = (affinity[b]?.[expert] ?? 0) - (affinity[a]?.[expert] ?? 0);
        return diff !== 0 ? diff : a - b;
    });
    return order.slice(0, Math.min(k, n));
}

function makeCells(
    affinity: number[][],
    experts: number,
    chosen: Set<string>,
    currentExpert: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < affinity.length; row += 1) {
        for (let col = 0; col < experts; col += 1) {
            const value = affinity[row]?.[col] ?? 0;
            const isChosen = chosen.has(`${row}-${col}`);
            const state: EntityState = isChosen
                ? "sorted"
                : col === currentExpert
                  ? "comparing"
                  : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, chosen: isChosen },
            });
        }
    }
    return entities;
}

/** The expert-choice routing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RoutingInput | null) ?? {};
    const affinity = Array.isArray(task.affinity)
        ? task.affinity.map((row) => [...row])
        : [
              [0.9, 0.1, 0.8],
              [0.7, 0.6, 0.2],
              [0.3, 0.95, 0.5],
              [0.4, 0.8, 0.9],
          ];
    const n = affinity.length;
    const experts = affinity[0]?.length ?? 1;
    const k = Math.max(1, Math.min(n, typeof task.k === "number" ? Math.trunc(task.k) : 2));

    const assignment: number[][] = [];
    const chosen = new Set<string>();
    for (let expert = 0; expert < experts; expert += 1) {
        const tokens = chooseTokens(affinity, expert, k);
        assignment.push(tokens);
        for (const token of tokens) {
            chosen.add(`${token}-${expert}`);
        }
    }
    const loads: number[] = Array(n).fill(0);
    for (const tokens of assignment) {
        for (const token of tokens) {
            loads[token] = (loads[token] ?? 0) + 1;
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(affinity, experts, chosen, -1),
        edges: [],
        description: `${n} tokens, ${experts} experts, capacity ${k} per expert; each expert will choose its favorite tokens.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: experts, n, experts, k, expert: -1, loads },
    };
    step += 1;

    for (let expert = 0; expert < experts; expert += 1) {
        const visible = new Set<string>();
        for (let e = 0; e <= expert; e += 1) {
            for (const token of assignment[e] ?? []) {
                visible.add(`${token}-${e}`);
            }
        }
        const tokens = assignment[expert] ?? [];
        yield {
            stepNumber: step,
            entities: makeCells(affinity, experts, visible, expert),
            edges: [],
            description: `Expert ${expert} selects tokens [${tokens.join(", ")}] with affinity ${tokens.map((t) => (affinity[t]?.[expert] ?? 0).toFixed(2)).join(", ")}.`,
            codeLineNumber: expert === experts - 1 ? 4 : 2,
            layout: "matrix",
            meta: {
                rows: n,
                cols: experts,
                n,
                experts,
                k,
                expert,
                selected: tokens,
                loads: loads.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(affinity, experts, chosen, -1),
        edges: [],
        description: `Done: ${experts * k} assignments; token loads [${loads.join(", ")}] are balanced by the fixed capacity.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: {
            rows: n,
            cols: experts,
            n,
            experts,
            k,
            expert: experts,
            assignment: assignment.reduce<number[]>((acc, row) => acc.concat(row), []),
            loads,
            totalAssignments: experts * k,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Flip the usual routing direction. Instead of asking each token which expert it prefers, ask every expert which tokens it wants most. Give each expert the same number of slots, so the workload cannot drift: every expert always processes exactly its capacity of tokens.",
        invariants: [
            "Every expert selects exactly k tokens, or all n tokens when k exceeds n.",
            "A token may be selected by zero, one, or several experts.",
            "The sum of token loads equals the number of experts times k.",
        ],
        correctness:
            "For one expert, sorting the n affinities in descending order and taking the first k entries returns exactly the k largest values; breaking ties by lower token index makes the choice deterministic. Repeating for every expert gives the assignment, and summing the per-token counts over all experts must equal E times k because each expert contributes exactly k entries.",
        complexityRationale:
            "Sorting n tokens costs O(n log n) per expert, so E experts take O(E * n log n). The stored assignment has E times k token indices, which is O(E * k) space.",
        uses: [
            "Mixture-of-experts layers with guaranteed expert balance",
            "Sparse transformer models with fixed expert capacity",
            "Avoiding auxiliary load-balancing losses during training",
        ],
        references: [
            "Zhou et al., Expert Choice Routing, NeurIPS 2022",
            "Shazeer et al., Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer, 2017",
        ],
        workedExample:
            "With four tokens, three experts, and capacity two, an expert with affinities 0.9, 0.7, 0.3, 0.4 chooses tokens 0 and 1. After all three experts choose, the per-token loads might be 1, 1, 1, 1, and their sum equals three times two.",
    },
    id: "expert-choice-routing",
    name: "Expert-Choice Routing",
    category: "ml-ai",
    complexity: { time: "O(E * n log n)", space: "O(E * k)" },
    defaultInput: {
        affinity: [
            [0.9, 0.1, 0.8],
            [0.7, 0.6, 0.2],
            [0.3, 0.95, 0.5],
            [0.4, 0.8, 0.9],
        ],
        k: 2,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "read the token by expert affinity matrix and capacity k",
        "for each expert sort token indices by descending affinity",
        "break ties by choosing the smaller token index",
        "assign the top k tokens to that expert",
        "count how many experts selected each token",
        "verify the loads sum to experts times k",
        "done: report the assignment and token loads",
    ],
};

export default module;
