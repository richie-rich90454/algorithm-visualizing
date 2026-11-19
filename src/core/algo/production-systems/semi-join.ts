/**
 * semi-join.ts - Semi-Join Reduction for Distributed Query Processing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A semi-join shrinks one relation before shipping it across a network. The
 * join keys of the right relation are sent to the left site, which discards any
 * tuple that cannot possibly match. Only the reduced left relation is then sent
 * to complete the join. The final result is identical to the natural join of
 * the two full relations, but the transferred data is smaller.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(|L| + |S| + k) for k output pairs
 *   Space: O(|S| + |L|) for the key set and the reduced relation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Cells in row 0 are left tuples; cells in row 1 are right tuples.
 *   - Discarded left tuples turn red and surviving ones turn green.
 *   - meta carries the key set, the reduced side, and the joined pairs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Tuple {
    id: string;
    key: number;
}

/** The result of a semi-join reduction and final join. */
export interface SemiJoinResult {
    keys: number[];
    reduced: string[];
    pairs: string[];
}

/** Reduce the left relation by right keys, then join on those keys. */
export function semiJoin(left: Tuple[], right: Tuple[]): SemiJoinResult {
    const keySet = new Set(right.map((tuple) => tuple.key));
    const keys = Array.from(keySet).sort((a, b) => a - b);
    const reducedTuples = left.filter((tuple) => keySet.has(tuple.key));
    const reduced = reducedTuples.map((tuple) => tuple.id);
    const pairs: string[] = [];
    for (const leftTuple of reducedTuples) {
        for (const rightTuple of right) {
            if (rightTuple.key === leftTuple.key) {
                pairs.push(`${leftTuple.id}|${rightTuple.id}`);
            }
        }
    }
    return { keys, reduced, pairs };
}

/** Build the two-row grid of left and right tuples. */
function makeCells(
    left: Tuple[],
    right: Tuple[],
    phase: "start" | "project" | "reduce" | "join",
    result: SemiJoinResult,
    activePair: number,
): VisualEntity[] {
    const keySet = new Set(result.keys);
    const cells: VisualEntity[] = [];
    left.forEach((tuple, col) => {
        const kept = keySet.has(tuple.key);
        let state: EntityState = "idle";
        if (phase === "reduce" || phase === "join" || phase === "project") {
            state = kept ? "sorted" : "error";
        }
        cells.push({
            id: `left-${col}`,
            type: "cell" as const,
            label: `L:${tuple.id} (k=${tuple.key})`,
            value: tuple.key,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, id: tuple.id, key: tuple.key, kept: kept ? 1 : 0 },
        });
    });
    right.forEach((tuple, col) => {
        cells.push({
            id: `right-${col}`,
            type: "cell" as const,
            label: `S:${tuple.id} (k=${tuple.key})`,
            value: tuple.key,
            state: phase === "start" ? "idle" : "visited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col, id: tuple.id, key: tuple.key },
        });
    });
    if (phase === "join" && activePair >= 0) {
        const pair = result.pairs[activePair]?.split("|") ?? [];
        for (const cell of cells) {
            const id = String(cell.metadata["id"] ?? "");
            if (pair.includes(id)) {
                cell.state = "comparing";
            }
        }
    }
    return cells;
}

/** The semi-join generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { left?: Tuple[]; right?: Tuple[] } | null) ?? {};
    const left: Tuple[] = Array.isArray(task.left) && task.left.length > 0
        ? task.left.map((tuple) => ({ id: String(tuple.id), key: Math.floor(tuple.key) }))
        : [
              { id: "L1", key: 2 },
              { id: "L2", key: 5 },
              { id: "L3", key: 7 },
              { id: "L4", key: 2 },
          ];
    const right: Tuple[] = Array.isArray(task.right) && task.right.length > 0
        ? task.right.map((tuple) => ({ id: String(tuple.id), key: Math.floor(tuple.key) }))
        : [
              { id: "S1", key: 2 },
              { id: "S2", key: 7 },
          ];
    const result = semiJoin(left, right);
    const cols = Math.max(left.length, right.length);

    yield {
        stepNumber: 0,
        entities: makeCells(left, right, "start", result, -1),
        edges: [],
        description: `Semi-join: reduce ${left.length} left tuple(s) using ${right.length} right tuple(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 2,
            cols,
            keys: [] as number[],
            reduced: [] as string[],
            pairs: [] as string[],
            resultCount: 0,
        },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(left, right, "project", result, -1),
        edges: [],
        description: `Project the right join keys: ${result.keys.join(", ") || "none"}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 2, cols, keys: result.keys, reduced: [], pairs: [], resultCount: 0 },
    };

    yield {
        stepNumber: 2,
        entities: makeCells(left, right, "reduce", result, -1),
        edges: [],
        description: `Keep ${result.reduced.length} of ${left.length} left tuples; the rest cannot match.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: 2, cols, keys: result.keys, reduced: result.reduced, pairs: [], resultCount: 0 },
    };

    let step = 3;
    for (let i = 0; i < result.pairs.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(left, right, "join", result, i),
            edges: [],
            description: `Join pair ${i + 1}: ${result.pairs[i]}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                keys: result.keys,
                reduced: result.reduced,
                pairs: result.pairs.slice(0, i + 1),
                resultCount: i + 1,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(left, right, "join", result, -1),
        edges: [],
        description: `Done: ${result.pairs.length} joined pair(s) from ${result.reduced.length} reduced tuple(s).`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: 2,
            cols,
            keys: result.keys,
            reduced: result.reduced,
            pairs: result.pairs,
            resultCount: result.pairs.length,
            done: true,
        },
    };
}

/** The semi-join module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Before shipping a large table across a network, send only the small list of join keys from the remote table. The local site throws away every tuple whose key is not on that list, so the transfer carries only rows that can actually contribute to the answer. Joining what remains gives exactly the same result as joining the original tables.",
        invariants: [
            "The key set contains exactly the keys present in the right relation.",
            "Every reduced left tuple is a tuple of the original left relation with a matching key.",
            "Each joined pair shares the same key in both relations.",
        ],
        correctness:
            "A left tuple can appear in the natural join only if some right tuple shares its key, which is precisely membership in the projected key set. Therefore filtering by that key set removes no tuple that would have contributed a result and keeps no tuple that cannot. Pairing each surviving left tuple with every right tuple of equal key enumerates the natural join exactly once per matching combination, so the semi-join result and the full join are identical.",
        complexityRationale:
            "Building the key set scans the right relation once, filtering scans the left once, and the join visits each surviving left tuple against the right relation, costing O(|L| plus |S| plus k) where k is the number of output pairs. The key set and reduced relation use O(|S| plus |L|) space.",
        uses: [
            "Distributed query optimizers that minimize network transfer",
            "Join filtering in federated and wide-area databases",
            "Reducing rows before a map-reduce or shuffle join",
        ],
        references: [
            "Bernstein and Chiu, Using Semi-Joins to Solve Relational Queries, 1981",
            "Silberschatz, Korth, and Sudarshan, Database System Concepts, Chapter on Query Processing",
        ],
        workedExample:
            "Left tuples L1 key 2, L2 key 5, L3 key 7 and right tuples S1 key 2, S2 key 7 project the key set {2, 7}. L2 is discarded, leaving L1, L3, and L4 if present. Joining produces L1 with S1 and L3 with S2, the same pairs a full natural join would return.",
    },
    id: "semi-join",
    name: "Semi-Join Reduction",
    category: "production-systems",
    complexity: { time: "O(|L| + |S| + k)", space: "O(|S| + |L|)" },
    defaultInput: {
        left: [
            { id: "L1", key: 2 },
            { id: "L2", key: 5 },
            { id: "L3", key: 7 },
            { id: "L4", key: 2 },
        ],
        right: [
            { id: "S1", key: 2 },
            { id: "S2", key: 7 },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "project the join keys of the right relation into a set",
        "send the key set to the site holding the left relation",
        "discard left tuples whose key is not in the set",
        "ship the reduced left relation back",
        "for each reduced tuple pair it with equal-key right tuples",
        "collect each matching pair into the result",
        "done: report the reduced side and the joined pairs",
    ],
};

export default module;
