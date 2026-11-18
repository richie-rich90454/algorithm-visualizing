/**
 * principal-variation-search.ts - Principal Variation Search
 *
 * PVS speeds up alpha-beta by searching the first (principal) child with the
 * full window and every later child with a null window of width one. If a
 * null-window search returns a score inside the full window, the result is
 * ambiguous and that child is re-searched with the real window. The extra
 * work is rare with good move ordering, so most children cost far less.
 *
 * Time O(b^(d/2)) with good ordering; space O(d).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function depthOf(size: number): number {
    let d = 0;
    let n = 1;
    while (n * 2 <= size) {
        n *= 2;
        d += 1;
    }
    return d;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { leaves?: number[] } | null) ?? {};
    const supplied = Array.isArray(task.leaves) && task.leaves.length >= 2 ? task.leaves : [3, 5, 2, 6, 1, 4, 7, 2];
    const depth = depthOf(supplied.length);
    const leaves = supplied.slice(0, 2 ** depth).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
    const firstLeaf = 2 ** depth;
    const total = 2 ** (depth + 1) - 1;

    const states: EntityState[] = new Array(total + 1).fill("unvisited");
    const values: number[] = new Array(total + 1).fill(0);
    let reSearches = 0;
    let nullWindows = 0;

    const edges = Array.from({ length: total }, (_, i) => i + 1)
        .filter((i) => i * 2 <= total)
        .flatMap((i) => [i * 2, i * 2 + 1].filter((c) => c <= total).map((c) => ({
            id: `edge-${i}-${c}`,
            sourceId: `node-${i}`,
            targetId: `node-${c}`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        })));

    const view = (): VisualEntity[] =>
        Array.from({ length: total }, (_, i) => i + 1).map((i) => {
            const level = Math.floor(Math.log2(i));
            return {
                id: `node-${i}`,
                type: "node" as const,
                label: level === depth ? String(leaves[i - firstLeaf] ?? 0) : String(values[i]),
                value: values[i] ?? 0,
                state: states[i] ?? "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: i === 1 ? "root" : `node-${Math.floor(i / 2)}`, level, index: i },
            };
        });

    let step = 0;
    yield {
        stepNumber: step,
        entities: view(),
        edges,
        description: `Principal variation search on a depth-${depth} tree; the first child gets the full window, later children get a null window.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { depth, leaves: [...leaves], nullWindows: 0, reSearches: 0 },
    };
    step += 1;

    function* pvs(i: number, alpha: number, beta: number, isMax: boolean): Generator<VisualFrame, number, unknown> {
        if (i >= firstLeaf) {
            const score = leaves[i - firstLeaf] ?? 0;
            values[i] = score;
            states[i] = "visited";
            return score;
        }
        const children = [i * 2, i * 2 + 1].filter((c) => c <= total);
        const first = children[0];
        let value = first === undefined ? 0 : yield* pvs(first, alpha, beta, !isMax);

        for (const child of children.slice(1)) {
            if (isMax) {
                nullWindows += 1;
                let score = yield* pvs(child, value, value + 1, false);
                if (score > value && score < beta) {
                    reSearches += 1;
                    score = yield* pvs(child, value, beta, false);
                }
                value = Math.max(value, score);
            } else {
                nullWindows += 1;
                let score = yield* pvs(child, value - 1, value, true);
                if (score < value && score > alpha) {
                    reSearches += 1;
                    score = yield* pvs(child, alpha, value, true);
                }
                value = Math.min(value, score);
            }
        }
        values[i] = value;
        states[i] = "comparing";
        yield {
            stepNumber: step,
            entities: view(),
            edges,
            description: `${isMax ? "MAX" : "MIN"} node ${i} finished with value ${value} after ${nullWindows} null-window probe(s) and ${reSearches} re-search(es).`,
            codeLineNumber: isMax ? 4 : 6,
            layout: "tree",
            meta: { node: i, isMax, value, nullWindows, reSearches },
        };
        step += 1;
        states[i] = "sorted";
        return value;
    }

    const rootValue = yield* pvs(1, -Infinity, Infinity, true);
    states[1] = "sorted";
    yield {
        stepNumber: step,
        entities: view(),
        edges,
        description: `PVS returns minimax value ${rootValue}, using ${nullWindows} null-window searches and ${reSearches} full re-searches.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { value: rootValue, optimal: rootValue, nullWindows, reSearches, depth },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Once one good child has been examined, most other children are unlikely to beat it. PVS tests that hunch with a nearly zero-width window: if the scout search fails to beat the current best, no full search is needed. Only a child that might actually improve the value pays for a full re-search.",
        invariants: [
            "The first child is always searched with the full alpha-beta window.",
            "A null-window probe either refutes a child or leaves its score ambiguous.",
            "The returned root value is identical to plain alpha-beta.",
        ],
        correctness:
            "A null-window search at (v, v+1) tells us only whether a child's value is at most v or at least v+1. If it is at most v the child cannot improve the parent and is discarded safely. If it lands inside the full window the bound is inconclusive, so a full re-search computes the exact value. Every decision therefore uses a correct bound or an exact score, preserving the minimax value.",
        complexityRationale:
            "A null-window search visits far fewer nodes than a full search under good ordering, so the principal variation costs one normal alpha-beta search while the remaining children are cheap scouts; the ideal bound stays O(b^(d/2)). The recursion uses O(d) space.",
        uses: [
            "Chess engines such as those using principal variation search as a default",
            "Any alpha-beta engine that wants cheap verification of late moves",
            "Tournament-grade game search where node count dominates runtime",
        ],
        references: [
            "Fishburn, Another Optimization of Alpha-Beta Search (1982)",
            "Reinefeld, An Improvement of the Scout Tree-Search Algorithm (1983)",
        ],
        workedExample:
            "At a MAX node whose first child scores 5, a later child is scouted with window (5, 6). If the scout returns 3, the child cannot beat 5 and is done. If it returns 7, the child truly beats 5 and is re-searched with the full window to learn its exact score.",
    },
    id: "principal-variation-search",
    name: "Principal Variation Search",
    category: "game",
    complexity: { time: "O(b^(d/2))", space: "O(d)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2] },
    visualType: "tree",
    run,
    pseudocode: [
        "build a binary game tree with fixed leaf scores",
        "search the first child with the full window (alpha, beta)",
        "for each later child set a null window around the current best",
        "if the null-window result is inside the full window re-search it",
        "update the best value with the confirmed child score",
        "recurse to the parent with the updated value",
        "report the root minimax value and the re-search count",
    ],
};

export default module;
