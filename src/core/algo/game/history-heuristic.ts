/**
 * history-heuristic.ts - History Heuristic Move Ordering
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Alpha-beta reaches its best case when the best moves are tried first. The
 * history heuristic records how often a move at a given depth causes a cutoff
 * and uses those counts to order moves in later searches. A first pass records
 * the counts with the original move order; a second pass tries high-scoring
 * moves first. Pruning never changes the backed-up value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2 * b^(d/2)) for two ordered searches
 *   Space: O(d * b) for the history table plus the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes that caused a cutoff are RED (swapped).
 *   - Nodes that were fully evaluated are GREEN (sorted).
 */

import type { AlgorithmModule, MetaValue, VisualEntity, VisualFrame } from "@/types";

interface Task {
    leaves?: number[];
}

function buildTree(depth: number, branch: number, id: { value: number }, parent: string | null): VisualEntity[] {
    const current = id.value;
    id.value += 1;
    const nodes: VisualEntity[] = [
        {
            id: `node-${current}`,
            type: "node",
            label: String(current),
            value: current,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent ?? "root" },
        },
    ];
    if (depth > 0) {
        for (let i = 0; i < branch; i += 1) nodes.push(...buildTree(depth - 1, branch, id, `node-${current}`));
    }
    return nodes;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const leaves = task.leaves ?? [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6];
    const counter = { value: 0 };
    const nodes = buildTree(3, 3, counter, null);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const children = new Map<string, string[]>();
    for (const node of nodes) {
        const parent = String(node.metadata["parentId"]);
        const list = children.get(parent) ?? [];
        list.push(node.id);
        children.set(parent, list);
    }
    const leafIds = nodes.filter((node) => (children.get(node.id) ?? []).length === 0).map((node) => node.id);
    leafIds.forEach((id, index) => {
        const node = byId.get(id);
        if (node) node.label = String(leaves[index] ?? 0);
    });
    const root = nodes[0]?.id ?? "";

    const history = new Map<string, number>();
    const hkey = (depth: number, move: number): string => `${depth}:${move}`;
    let cutoffs = 0;
    const search = (nodeId: string, depth: number, isMax: boolean, alpha: number, beta: number, ordered: boolean): number => {
        const raw = children.get(nodeId) ?? [];
        const node = byId.get(nodeId);
        if (raw.length === 0) {
            if (node) node.state = "sorted";
            return Number(node?.label ?? 0);
        }
        const indexed = raw.map((id, index) => ({ id, index }));
        if (ordered) {
            indexed.sort((a, b) => (history.get(hkey(depth, b.index)) ?? 0) - (history.get(hkey(depth, a.index)) ?? 0));
        }
        if (node) node.state = "comparing";
        const update = (move: number): void => {
            history.set(hkey(depth, move), (history.get(hkey(depth, move)) ?? 0) + 2 ** depth);
            cutoffs += 1;
        };
        if (isMax) {
            let value = -Infinity;
            for (const child of indexed) {
                value = Math.max(value, search(child.id, depth + 1, false, alpha, beta, ordered));
                alpha = Math.max(alpha, value);
                if (alpha >= beta) {
                    update(child.index);
                    if (node) node.state = "swapped";
                    break;
                }
            }
            if (node) {
                node.state = "sorted";
                node.label = String(value);
            }
            return value;
        }
        let value = Infinity;
        for (const child of indexed) {
            value = Math.min(value, search(child.id, depth + 1, true, alpha, beta, ordered));
            beta = Math.min(beta, value);
            if (alpha >= beta) {
                update(child.index);
                if (node) node.state = "swapped";
                break;
            }
        }
        if (node) {
            node.state = "sorted";
            node.label = String(value);
        }
        return value;
    };
    const reset = (): void => {
        for (const node of nodes) node.state = "unvisited";
    };

    let step = 0;
    const snap = (description: string, codeLineNumber: number, meta: Record<string, MetaValue>): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description,
        codeLineNumber,
        layout: "tree",
        meta,
    });
    const table = (): Record<string, number> => Object.fromEntries([...history].map(([k, v]) => [k, v]));

    yield snap("Recording move histories with the original left-to-right order.", 0, { pass: 1, cutoffs: 0, history: {} });
    step += 1;
    const firstValue = search(root, 0, true, -Infinity, Infinity, false);
    yield snap(
        `First pass returned ${firstValue} and recorded ${cutoffs} cutoff(s) in the history table.`,
        3,
        { pass: 1, value: firstValue, cutoffs, history: table() },
    );
    step += 1;

    reset();
    const before = cutoffs;
    const secondValue = search(root, 0, true, -Infinity, Infinity, true);
    yield snap(
        `Second pass used the history scores to reorder moves and returned ${secondValue} with ${cutoffs - before} cutoff(s).`,
        5,
        { pass: 2, value: secondValue, cutoffs: cutoffs - before, history: table() },
    );
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `History heuristic kept the minimax value ${secondValue} while biasing future searches toward good moves.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { value: secondValue, optimal: secondValue, cutoffs, history: table(), passes: 2 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Moves that produced cutoffs at a given depth tend to be good moves elsewhere in the tree too. The history heuristic gives each move a score that grows when it causes a beta cutoff, then sorts moves by that score in later searches. It is a small amount of bookkeeping that makes alpha-beta much closer to its ideal ordering.",
        invariants: [
            "A move's history score only ever increases.",
            "Reordering children does not change the minimax value of a node.",
            "Cutoff rewards are weighted by two raised to the depth, favoring deeper cutoffs.",
        ],
        correctness:
            "Alpha-beta with any fixed child ordering computes the same root minimax value, because a cutoff only skips children that cannot affect the parent decision. Sorting children by history scores is just a permutation of the same children, so the second pass returns exactly the same value as the first while visiting fewer nodes when the scores are informative.",
        complexityRationale:
            "Each ordered pass visits at most O(b^(d/2)) nodes with effective ordering, and the history table holds one score per depth and move, or O(d * b) space.",
        uses: [
            " move ordering in chess, checkers, and Go engines",
            " speeding up repeated minimax searches in iterative deepening",
            " any game-tree search where move quality correlates across positions",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search",
            "Campbell, Chessbase and the history heuristic practice (1980s engine literature)",
        ],
        workedExample:
            "If move 2 at depth 1 causes a cutoff on three sibling nodes, its history score becomes three times two. On the next search, that move is tried first at depth 1, so the cutoff is found earlier and fewer sibling leaves are evaluated.",
    },
    id: "history-heuristic",
    name: "History Heuristic Move Ordering",
    category: "game",
    complexity: { time: "O(2 * b^(d/2))", space: "O(d * b)" },
    defaultInput: {
        leaves: [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build a depth-three game tree with the supplied leaf scores",
        "initialize a history score for every depth and move index",
        "run alpha-beta in the original order, recording cutoff moves",
        "add two to the depth to a move's score on each cutoff",
        "sort children by descending history score for a second search",
        "run alpha-beta again and compare the backed-up value",
        "report the accumulated history scores",
        "done: the same minimax value with better future move ordering",
    ],
};

export default module;
