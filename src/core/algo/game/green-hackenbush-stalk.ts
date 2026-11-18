/**
 * green-hackenbush-stalk.ts – Green Hackenbush Stalk (bamboo cutting game)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Green Hackenbush stalk is a single bamboo column; a cut removes that
 * edge and everything above it. Simply: cut at the base and take the whole
 * stalk. Formally: the stalk is a Nim heap where any n > 0 is an
 * N-position, cutting at edge i moves to size i, and cutting the base edge
 * moves to 0, the lone P-position.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) over the edges
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Stalk edges show as segments; the cut edge flashes YELLOW.
 *   - The empty stalk shows zero edges for the stranded opponent.
 *   - The verdict names the first-player win on every nonzero stalk.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Equivalent to a Nim heap of size n.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function stalkCells(edges: number, cut = -1): VisualEntity[] {
    return Array.from({ length: Math.max(edges, 1) }, (_, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: i < edges ? "┃" : "",
        value: i < edges ? 1 : 0,
        state: (i >= edges ? "unvisited" : i === cut ? "comparing" : "sorted") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: Math.max(edges, 1) - 1 - i, col: 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: number } | null) ?? {};
    const edges =
        typeof task.edges === "number" && task.edges >= 0 ? Math.min(9, Math.floor(task.edges)) : 5;
    let step = 0;
    yield {
        stepNumber: step,
        entities: stalkCells(edges),
        edges: [],
        description: `Green Hackenbush stalk of ${edges} edge${edges === 1 ? "" : "s"} – a Nim heap of size ${edges}, winning unless empty.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { edges, heap: edges, winning: edges > 0 },
    };
    step += 1;
    if (edges === 0) {
        yield {
            stepNumber: step,
            entities: stalkCells(0),
            edges: [],
            description: "Empty stalk – no cut exists, so the player to move loses.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { edges, winning: false },
        };
        step += 1;
        yield {
            stepNumber: step,
            entities: stalkCells(0),
            edges: [],
            description: "The empty stalk is a P-position.",
            codeLineNumber: 2,
            layout: "grid",
            meta: { edges, winning: false },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: stalkCells(edges, 0),
        edges: [],
        description: `Stalk ${edges} can move to any smaller size 0..${edges - 1}; highlighted cut at base edge 0.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { edges, heap: edges, cut: 0 },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stalkCells(edges, 0),
        edges: [],
        description: `Winning Hackenbush move: cut base edge 0 of stalk ${edges}, removing the whole stalk at once.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { edges, cut: 0, winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stalkCells(0),
        edges: [],
        description: "Empty stalk 0 remains – the opponent has no cut and loses the game.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { edges: 0, heap: 0, winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: stalkCells(0),
        edges: [],
        description: `First player wins the ${edges}-edge stalk by cutting it all to zero.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { edges, heap: 0, winning: true, winner: "First" },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A Green Hackenbush stalk is a vertical bamboo of edges rooted in the ground. Cutting an edge removes it and everything above it, so a stalk of n edges behaves exactly like a Nim heap of size n. With green edges both players may cut anywhere.",
        "invariants": [
            "Cutting edge i leaves a stalk of i edges below it.",
            "A stalk of zero edges is the only losing P-position.",
            "Every nonzero stalk is a nimber equal to its edge count."
        ],
        "correctness": "The stalk is a Nim heap because the reachable positions after a cut are precisely stalks of every smaller size. By the Sprague-Grundy definition the value is mex of those smaller values, which is n by induction starting from G(0) equal to zero. Any positive stalk can therefore be reduced to zero in one move.",
        "complexityRationale": "Scanning the n edges costs O(n) time and the representation uses O(1) extra space.",
        "uses": [
            "The simplest example of the colon principle in Hackenbush",
            "Introducing the equivalence between stalks and Nim heaps",
            "A building block for sums of green Hackenbush graphs"
        ],
        "references": [
            "Conway, On Numbers and Games",
            "Berlekamp, Conway, and Guy, Winning Ways for Your Mathematical Plays"
        ],
        "workedExample": "A stalk of 5 edges is a Nim heap of size 5. Cutting the base edge removes all 5 edges and leaves the empty stalk of size 0. Since only the empty stalk is losing, the first player wins immediately by cutting at the base."
    },
    id: "green-hackenbush-stalk",
    name: "Green Hackenbush Stalk",
    category: "game",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { edges: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "model the stalk of n edges as a Nim heap of size n",
        "if n = 0: empty stalk with no cut, losing P-position",
        "any cut at edge i moves to a smaller stalk of size i",
        "winning move is cutting the base edge, removing all n edges",
        "show empty stalk 0 with no legal cut for the opponent",
        "winner is first player on every nonzero stalk by taking all",
    ],
};

export default module;
