/**
 * aspiration-windows.ts - Alpha-Beta With Aspiration Windows
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Instead of searching the root with the full score range, an aspiration
 * search guesses the answer and examines a narrow window around it. A null
 * window of width one is cheapest. If it fails high or fails low, the search
 * is repeated with a half-open window on the indicated side. The final value
 * is exactly the minimax value, but most of the tree is visited only once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^(d/2)) per pass, with at most two re-searches
 *   Space: O(d) for the recursion stack plus the game tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Evaluated nodes are GREEN (sorted).
 *   - Each pass is narrated with its window and fail-high or fail-low result.
 */

import type { AlgorithmModule, MetaValue, VisualEntity, VisualFrame } from "@/types";

interface Task {
    leaves?: number[];
    guess?: number;
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
        for (let i = 0; i < branch; i += 1) {
            nodes.push(...buildTree(depth - 1, branch, id, `node-${current}`));
        }
    }
    return nodes;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const leaves = task.leaves ?? [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6];
    const guess = typeof task.guess === "number" ? Math.floor(task.guess) : 5;
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

    const search = (nodeId: string, isMax: boolean, alpha: number, beta: number): number => {
        const kids = children.get(nodeId) ?? [];
        const node = byId.get(nodeId);
        if (kids.length === 0) {
            if (node) node.state = "sorted";
            return Number(node?.label ?? 0);
        }
        if (node) node.state = "comparing";
        if (isMax) {
            let value = -Infinity;
            for (const child of kids) {
                value = Math.max(value, search(child, false, alpha, beta));
                alpha = Math.max(alpha, value);
                if (alpha >= beta) break;
            }
            if (node) {
                node.state = "sorted";
                node.label = String(value);
            }
            return value;
        }
        let value = Infinity;
        for (const child of kids) {
            value = Math.min(value, search(child, true, alpha, beta));
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
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

    yield snap(
        `Guessing a minimax value of ${guess}; first pass searches the null window [${guess}, ${guess + 1}].`,
        0,
        { guess, alpha: guess, beta: guess + 1, passes: 0 },
    );
    step += 1;

    const first = search(root, true, guess, guess + 1);
    const verdict = first <= guess ? "fail low" : first >= guess + 1 ? "fail high" : "exact";
    yield snap(
        `Null-window pass returned ${first}: ${verdict}.`,
        3,
        { result: first, alpha: guess, beta: guess + 1, verdict, passes: 1 },
    );
    step += 1;

    let value = first;
    let passes = 1;
    if (verdict === "fail low") {
        reset();
        value = search(root, true, -Infinity, guess);
        passes += 1;
        yield snap(
            `Re-search with window [-inf, ${guess}] returned ${value}.`,
            5,
            { result: value, verdict: "fail low", passes },
        );
        step += 1;
    } else if (verdict === "fail high") {
        reset();
        value = search(root, true, guess + 1, Infinity);
        passes += 1;
        yield snap(
            `Re-search with window [${guess + 1}, +inf] returned ${value}.`,
            5,
            { result: value, verdict: "fail high", passes },
        );
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `Aspiration search found the exact minimax value ${value} in ${passes} pass(es).`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { value, optimal: value, guess, passes, verdict },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A full-width alpha-beta window is conservative: it makes no assumption about the answer. If the score is predictable, searching a tiny window around the guess is much cheaper. A width-one window only tells us whether the guess is too low, too high, or exactly right; only a wrong guess needs a second search.",
        invariants: [
            "A null-window search returns a lower or upper bound rather than a possibly exact value.",
            "A fail-low result means the true value is at most the guess.",
            "A fail-high result means the true value is at least the guess plus one.",
        ],
        correctness:
            "Fail-soft alpha-beta returns a value at most alpha when it fails low and at least beta when it fails high, and the exact value when the result lies strictly inside the window. Re-searching with the appropriate half-open window places the true value inside a valid window, so the second pass returns the exact minimax value.",
        complexityRationale:
            "Each pass is ordinary alpha-beta, costing O(b^(d/2)) with good ordering, and at most two passes follow the initial null-window search. The recursion stack and tree need O(d) plus the tree size.",
        uses: [
            " chess and shogi engines reusing the previous iteration's score",
            " iterative deepening searches with narrow windows",
            " any minimax search with a reliable score prediction",
        ],
        references: [
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning (1975)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search",
        ],
        workedExample:
            "Guessing 5 on a tree whose true minimax value is 7 makes the null window [5, 6] fail high. Re-searching with [6, +infinity] returns 7 exactly, whereas a full search would have explored both sides of the range.",
    },
    id: "aspiration-windows",
    name: "Alpha-Beta With Aspiration Windows",
    category: "game",
    complexity: { time: "O(b^(d/2)) per pass", space: "O(d)" },
    defaultInput: {
        leaves: [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
        guess: 5,
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build a depth-three game tree with the supplied leaf scores",
        "choose a guessed value g and search the window [g, g+1]",
        "if the result is inside the window, it is the exact value",
        "if it fails low, re-search with window [-infinity, g]",
        "if it fails high, re-search with window [g+1, +infinity]",
        "paint evaluated nodes and report each pass",
        "report the window result for each pass",
        "done: the exact minimax value with at most three passes",
    ],
};

export default module;
