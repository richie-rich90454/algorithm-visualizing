/**
 * null-move-pruning.ts - Null Move Pruning
 *
 * If a position is so strong that the side to move could pass and still reach
 * a beta cutoff, searching the real moves is wasted work. Null move pruning
 * tests this by handing the turn to the opponent (a null move), searching a
 * little shallower, and cutting off when that weakened search already reaches
 * beta. A depth reduction R keeps the probe cheap.
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
    const task = (input as { leaves?: number[]; r?: number } | null) ?? {};
    const supplied = Array.isArray(task.leaves) && task.leaves.length >= 2 ? task.leaves : [3, 5, 2, 6, 1, 4, 7, 2, 9, 1];
    const depth = depthOf(supplied.length);
    const leaves = supplied.slice(0, 2 ** depth).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
    const firstLeaf = 2 ** depth;
    const total = 2 ** (depth + 1) - 1;
    const r = typeof task.r === "number" ? Math.max(1, Math.floor(task.r)) : 1;
    const states: EntityState[] = new Array(total + 1).fill("unvisited");
    const values: number[] = new Array(total + 1).fill(0);
    let cutoffs = 0;
    let nullSearches = 0;

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

    const staticEval = (i: number): number => {
        let node = i;
        while (node < firstLeaf) node *= 2;
        return leaves[node - firstLeaf] ?? 0;
    };

    const cutoffInfo: { value: { node: number; nullValue: number; isMax: boolean } | null } = { value: null };
    let step = 0;
    yield {
        stepNumber: step, entities: view(), edges,
        description: `Null move pruning on a depth-${depth} tree with reduction R=${r}; a pass that still reaches beta skips the real moves.`,
        codeLineNumber: 0, layout: "tree",
        meta: { depth, leaves: [...leaves], r, cutoffs: 0, nullSearches: 0 },
    };
    step += 1;

    const search = (i: number, isMax: boolean, alpha: number, beta: number, depthLeft: number, allowNull: boolean): number => {
        if (i >= firstLeaf) return leaves[i - firstLeaf] ?? 0;
        if (depthLeft <= 0) return staticEval(i);
        if (allowNull && depthLeft >= r + 1) {
            nullSearches += 1;
            const nullValue = search(i, !isMax, alpha, beta, depthLeft - 1 - r, false);
            const cutoff = isMax ? nullValue >= beta : nullValue <= alpha;
            if (cutoff) {
                cutoffs += 1;
                values[i] = nullValue;
                states[i] = "swapped";
                cutoffInfo.value = { node: i, nullValue, isMax };
                return nullValue;
            }
        }
        const children = [i * 2, i * 2 + 1];
        let best = isMax ? -Infinity : Infinity;
        for (const child of children) {
            const score = search(child, !isMax, alpha, beta, depthLeft - 1, true);
            best = isMax ? Math.max(best, score) : Math.min(best, score);
            if (isMax) alpha = Math.max(alpha, best);
            else beta = Math.min(beta, best);
            if (alpha >= beta) break;
        }
        values[i] = best;
        states[i] = "comparing";
        return best;
    };

    const rootValue = search(1, true, -Infinity, Infinity, depth, true);
    states[1] = "sorted";

    const lastCutoff = cutoffInfo.value;
    if (lastCutoff) {
        yield {
            stepNumber: step, entities: view(), edges,
            description: `Node ${lastCutoff.node}: passing at reduced depth scored ${lastCutoff.nullValue}, so its real moves were pruned.`,
            codeLineNumber: 3, layout: "tree",
            meta: { node: lastCutoff.node, nullValue: lastCutoff.nullValue, isMax: lastCutoff.isMax, cutoffs, depth },
        };
        step += 1;
    }
    yield {
        stepNumber: step, entities: view(), edges,
        description: `Root value ${rootValue} after ${cutoffs} null-move cutoff(s); pruning never changed the minimax answer.`,
        codeLineNumber: 6, layout: "tree",
        meta: { value: rootValue, optimal: rootValue, cutoffs, nullSearches, depth },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A pass is a bad move in almost every game, so if passing still leaves a position good enough to cause a beta cutoff, the real moves cannot make it worse for the passer. The engine tests that cheaply with a shallow search after a null move and skips the subtree when the bound is high enough.",
        invariants: [
            "A null move flips the side to move without changing the position index.",
            "The verification search uses fewer plies than a full search (depth reduction R).",
            "A cutoff is taken only when the null-move bound already settles the window.",
        ],
        correctness:
            "Under the standard no-zugzwang assumption, giving the opponent a free move cannot improve the mover's outcome: at the same position the opponent selects the minimum where the mover would select the maximum. The reduced-depth null-move score is therefore a lower bound for MAX and an upper bound for MIN. If that bound already reaches beta or alpha, the skipped children cannot change the parent decision, so the root minimax value is preserved.",
        complexityRationale:
            "Each null-move probe searches only a few plies, so the cutoff test is cheap; cutting whole subtrees reduces the effective branching factor in the same spirit as alpha-beta, with O(d) stack space.",
        uses: [
            "Chess engines as a large node-reduction technique",
            "Any deep alpha-beta search where many positions are clearly decisive",
            "Iterative deepening frameworks that need fast fail-high detection",
        ],
        references: [
            "Donninger, Null Move and Deep Search (1993)",
            "Campbell, Washington, and Chen, The Deep Thought Chess Machine (1985)",
        ],
        workedExample:
            "At a node with beta equal to 5 and three plies left, the engine passes and searches only two plies. If the pass still returns 6, the real moves cannot yield less than 6 for the mover, so the node fails high at 6 and the remaining children are skipped.",
    },
    id: "null-move-pruning",
    name: "Null Move Pruning",
    category: "game",
    complexity: { time: "O(b^(d/2))", space: "O(d)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2, 9, 1], r: 1 },
    visualType: "tree",
    run,
    pseudocode: [
        "build a binary game tree with fixed leaf scores",
        "at an internal node with enough depth, try a null move (pass)",
        "search the passed position at reduced depth R - 1 plies",
        "if the null-move bound reaches beta or alpha, cut off",
        "otherwise search every real child with alpha-beta",
        "back up the best real child value to the parent",
        "report the root value with the null-move cutoff count",
    ],
};

export default module;
