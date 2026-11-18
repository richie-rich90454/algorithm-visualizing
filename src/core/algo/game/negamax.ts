/**
 * negamax.ts - Negamax Search
 *
 * A single recursive routine replaces the two MAX/MIN routines of minimax:
 * every node returns a score from the point of view of the player to move, and
 * the parent negates the child score before taking the maximum. Because a
 * zero-sum game flips sign on every ply, the negamax value at the root equals
 * the ordinary minimax value.
 *
 * Time O(b^d) on a full tree; space O(d) for the search path.
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
            const label = level === depth ? String(leaves[i - firstLeaf] ?? 0) : String(values[i]);
            return {
                id: `node-${i}`,
                type: "node" as const,
                label,
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
        description: `Negamax on a binary tree of depth ${depth} with ${leaves.length} leaf scores; scores are returned from the mover's point of view.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { depth, leaves: [...leaves], nodes: total },
    };
    step += 1;

    function* search(i: number): Generator<VisualFrame, number, unknown> {
        const level = Math.floor(Math.log2(i));
        if (i >= firstLeaf) {
            const raw = leaves[i - firstLeaf] ?? 0;
            const score = level % 2 === 0 ? raw : -raw;
            values[i] = score;
            states[i] = "visited";
            return score;
        }
        let best = -Infinity;
        for (const child of [i * 2, i * 2 + 1]) {
            if (child > total) continue;
            const childScore = yield* search(child);
            best = Math.max(best, -childScore);
        }
        values[i] = best;
        states[i] = "comparing";
        yield {
            stepNumber: step,
            entities: view(),
            edges,
            description: `Node ${i} negates each child score and keeps the maximum: -children gives ${best}.`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { node: i, level, value: best },
        };
        step += 1;
        states[i] = "sorted";
        return best;
    }

    const rootValue = yield* search(1);
    states[1] = "sorted";
    yield {
        stepNumber: step,
        entities: view(),
        edges,
        description: `Negamax root value ${rootValue} equals the minimax score under optimal play.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { value: rootValue, optimal: rootValue, depth },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of writing separate MAX and MIN procedures, negamax uses one procedure that always scores a position from the side to move's point of view. Because a zero-sum gain for one player is an equal loss for the other, a parent simply flips the sign of each child result and takes the maximum.",
        invariants: [
            "Every node returns a score from the perspective of the player to move there.",
            "A parent's score is the maximum of the negated child scores.",
            "The root score equals ordinary minimax for a zero-sum game.",
        ],
        correctness:
            "By induction on height, a leaf returns its utility with the sign chosen for the mover. For an internal node, negation converts each child's mover-perspective score into the current mover's perspective, so taking the maximum is exactly the optimal choice; at the root the mover is MAX and the value is the minimax value.",
        complexityRationale:
            "The full binary tree has O(2^d) nodes, each visited once, so time is O(b^d); recursion stores only the current path, giving O(d) space.",
        uses: [
            "Chess and checkers engines as the base search routine",
            "Any zero-sum adversarial search with alternating moves",
            "A compact starting point for alpha-beta and its enhancements",
        ],
        references: [
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, adversarial search chapter",
            "Knuth and Moore, An Analysis of Alpha-Beta Pruning (1975)",
        ],
        workedExample:
            "With leaf scores 3, 5, 2, 6 at depth two, a MIN-level node returns the negation of the maximum of the negated leaves, which is the minimum 3. The root then reports the maximum of such child scores; the sign flips cancel and the answer matches minimax.",
    },
    id: "negamax",
    name: "Negamax Search",
    category: "game",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: { leaves: [3, 5, 2, 6, 1, 4, 7, 2] },
    visualType: "tree",
    run,
    pseudocode: [
        "build a binary game tree with fixed leaf scores",
        "at a leaf return its score from the mover's perspective",
        "for each child compute the negamax value of that child",
        "negate the child value and keep the largest result",
        "store the best value at the current node",
        "unwind the recursion toward the root",
        "report the root value as the minimax game value",
    ],
};

export default module;
