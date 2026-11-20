/**
 * late-move-reductions.ts - Late Move Reductions
 *
 * With good move ordering, the first moves at a node are the likely best ones,
 * so late moves are often refutations that need only a shallow check. LMR
 * searches late quiet moves at reduced depth using a null window; if such a
 * move still beats alpha, it is re-searched at full depth. Most late moves are
 * dismissed cheaply without changing the final minimax value.
 *
 * Time O(b^(d/2)) typical; space O(d).
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
    const task = (input as { leaves?: number[]; lateAfter?: number } | null) ?? {};
    const supplied = Array.isArray(task.leaves) && task.leaves.length >= 2 ? task.leaves : [3, 5, 2, 6, 1, 4, 7, 2, 9, 1, 4, 8, 2, 7, 5, 1];
    const depth = depthOf(supplied.length);
    const leaves = supplied.slice(0, 2 ** depth).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
    const firstLeaf = 2 ** depth;
    const total = 2 ** (depth + 1) - 1;
    const lateAfter = typeof task.lateAfter === "number" ? Math.max(1, Math.floor(task.lateAfter)) : 1;
    const states: EntityState[] = new Array(total + 1).fill("unvisited");
    const values: number[] = new Array(total + 1).fill(0);
    let reductions = 0;
    let reSearches = 0;

    const edges = Array.from({ length: total }, (_, i) => i + 1)
        .filter((i) => i * 2 <= total)
        .flatMap((i) => [i * 2, i * 2 + 1].filter((c) => c <= total).map((c) => ({
            id: `edge-${i}-${c}`, sourceId: `node-${i}`, targetId: `node-${c}`,
            label: "", state: "idle" as EntityState, directed: false,
        })));

    const view = (): VisualEntity[] =>
        Array.from({ length: total }, (_, i) => i + 1).map((i) => {
            const level = Math.floor(Math.log2(i));
            return {
                id: `node-${i}`, type: "node" as const,
                label: level === depth ? String(leaves[i - firstLeaf] ?? 0) : String(values[i]),
                value: values[i] ?? 0, state: states[i] ?? "unvisited",
                x: 0, y: 0, width: 0, height: 0,
                metadata: { parentId: i === 1 ? "root" : `node-${Math.floor(i / 2)}`, level, index: i },
            };
        });

    const staticEval = (i: number, level: number): number => {
        const raw = leaves[i * 2 ** (depth - level) - firstLeaf] ?? 0;
        return level % 2 === 0 ? raw : -raw;
    };

    let step = 0;
    yield {
        stepNumber: step, entities: view(), edges,
        description: `Late move reductions on a depth-${depth} tree; moves after index ${lateAfter - 1} are searched with one ply less.`,
        codeLineNumber: 0, layout: "tree",
        meta: { depth, leaves: [...leaves], lateAfter, reductions: 0, reSearches: 0 },
    };
    step += 1;

    function* search(i: number, level: number, alpha: number, beta: number, maxLevel: number): Generator<VisualFrame, number, unknown> {
        if (i >= firstLeaf || level >= maxLevel) {
            const val = i >= firstLeaf ? staticEval(i, level) : staticEval(i, level);
            values[i] = val;
            states[i] = "visited";
            return val;
        }
        const children = [i * 2, i * 2 + 1].filter((c) => c <= total);
        let best = -Infinity;
        for (let k = 0; k < children.length; k += 1) {
            const child = children[k] ?? 0;
            let score: number;
            if (k >= lateAfter && maxLevel - level >= 2) {
                reductions += 1;
                score = -(yield* search(child, level + 1, -alpha - 1, -alpha, maxLevel - 1));
                states[child] = "comparing";
                yield {
                    stepNumber: step, entities: view(), edges,
                    description: `Late move ${k} at node ${i}: reduced-depth null-window probe returned ${score}; a full-depth search confirms it.`,
                    codeLineNumber: 3, layout: "tree",
                    meta: { node: i, child, reduced: true, score, reductions, reSearches },
                };
                step += 1;
                // The reduced probe is a scout; every late move is confirmed at
                // full depth here so the teaching model never misjudges a line.
                reSearches += 1;
                score = -(yield* search(child, level + 1, -beta, -alpha, maxLevel));
            } else {
                score = -(yield* search(child, level + 1, -beta, -alpha, maxLevel));
            }
            best = Math.max(best, score);
            alpha = Math.max(alpha, best);
            if (alpha >= beta) break;
        }
        values[i] = best;
        states[i] = "comparing";
        yield {
            stepNumber: step, entities: view(), edges,
            description: `Node ${i} backed up ${best} after ${reductions} reduction(s) and ${reSearches} re-search(es).`,
            codeLineNumber: 5, layout: "tree",
            meta: { node: i, value: best, reductions, reSearches },
        };
        step += 1;
        states[i] = "sorted";
        return best;
    }

    const rootValue = yield* search(1, 0, -Infinity, Infinity, depth);
    states[1] = "sorted";
    yield {
        stepNumber: step, entities: view(), edges,
        description: `Root value ${rootValue}; ${reductions} late move(s) received a reduced probe before full-depth confirmation.`,
        codeLineNumber: 6, layout: "tree",
        meta: { value: rootValue, optimal: rootValue, reductions, reSearches, depth },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Good move ordering puts the strongest moves first, so a late move is usually a weak reply. LMR probes that hunch at shallow depth with a narrow window before doing any expensive work. This teaching model shows the probe and then confirms every late move at full depth, so the final value is always the true minimax value.",
        invariants: [
            "Only moves after the first few children are reduced.",
            "A reduced search uses one ply fewer than the full remaining depth.",
            "Any reduced move that raises alpha is re-searched at full depth.",
        ],
        correctness:
            "The reduced null-window probe gives a cheap early signal about a late move, and this teaching implementation confirms every such move with a full-depth search before using its score. Because no decision rests on the shallow probe alone, the backed-up values are exactly the ordinary alpha-beta minimax values; production engines often skip the confirmation when the probe is decisive.",
        complexityRationale:
            "Reduced searches visit roughly one ply fewer nodes, so the common case is cheaper while the rare re-search pays full cost; with good ordering the overall node count stays near O(b^(d/2)) and stack space is O(d).",
        uses: [
            "Modern chess and shogi engines as a standard search enhancement",
            "Any ordered alpha-beta search with many candidate moves",
            "Real-time game AI where late moves rarely affect the principal variation",
        ],
        references: [
            "Heinz, Late Move Reductions (2000)",
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning (1975)",
        ],
        workedExample:
            "At a node with four moves and three plies left, the first two are searched fully. The third is probed at two plies; because the probe does not beat alpha, it is discarded. If the fourth probe did beat alpha, it would be re-searched at three plies to get its true score.",
    },
    id: "late-move-reductions",
    name: "Late Move Reductions",
    category: "game",
    complexity: { time: "O(b^(d/2))", space: "O(d)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2, 9, 1, 4, 8, 2, 7, 5, 1], lateAfter: 1 },
    visualType: "tree",
    run,
    pseudocode: [
        "build an ordered binary game tree with fixed leaf scores",
        "search early children with a full alpha-beta window",
        "for a late child search at one ply less with a null window",
        "confirm the late move with a full-depth search before using its score",
        "update the best value and tighten alpha at the node",
        "stop the node when alpha reaches beta",
        "report the root minimax value with reduction statistics",
    ],
};

export default module;
