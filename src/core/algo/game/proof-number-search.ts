/**
 * proof-number-search.ts – Proof-Number Search (AND/OR tree solver)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Proof-number search proves a game position by growing the smallest tree
 * that settles the root. Simply: expand the child closest to a proof first.
 * Formally: each node holds a proof number (leaves to prove) and a disproof
 * number (leaves to refute), with OR nodes taking min/sum and AND nodes
 * taking sum/min; the demo OR root over AND-node A and winning leaf B
 * proves the root with proof number 0 via B.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(nodes) expanded
 *   Space: O(nodes) tree state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being expanded flashes YELLOW (comparing).
 *   - Proven wins paint GREEN (sorted); refuted lines paint RED (swapped).
 *   - Labels show live proof and disproof numbers per node.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Root proof number 0 means proved winning; disproof 0 means refuted.
 *   - Best-first expansion beats full minimax on tactical positions.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const INF = 999;

function pnode(
    id: string,
    label: string,
    parent: string | null,
    state: EntityState,
    pn: number,
    dn: number,
): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: pn,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent ?? "root", pn, dn },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { extra?: boolean } | null) ?? {};
    void task;
    // Fixed shape, but every number below is derived from the leaf outcomes.
    const leafW: [number, number] = [0, INF];
    const leafL: [number, number] = [INF, 0];
    const andA: [number, number] = [leafW[0] + leafL[0], Math.min(leafW[1], leafL[1])];
    const root: [number, number] = [Math.min(andA[0], leafW[0]), andA[1] + leafW[1]];
    let step = 0;
    const tree = (hot: string, done: boolean): VisualEntity[] => [
        pnode(
            "root",
            `OR pn=${root[0]} dn=${root[1]}`,
            null,
            done ? "sorted" : hot === "root" ? "comparing" : "idle",
            root[0],
            root[1],
        ),
        pnode(
            "a",
            `AND pn=${andA[0]} dn=${andA[1]}`,
            "root",
            hot === "a" ? "comparing" : "highlight",
            andA[0],
            andA[1],
        ),
        pnode(
            "b",
            `W pn=${leafW[0]} dn=${leafW[1]}`,
            "root",
            hot === "b" ? "comparing" : "sorted",
            leafW[0],
            leafW[1],
        ),
        pnode(
            "w1",
            `W pn=${leafW[0]} dn=${leafW[1]}`,
            "a",
            hot === "w1" ? "comparing" : "sorted",
            leafW[0],
            leafW[1],
        ),
        pnode(
            "l1",
            `L pn=${leafL[0]} dn=${leafL[1]}`,
            "a",
            hot === "l1" ? "comparing" : "swapped",
            leafL[0],
            leafL[1],
        ),
    ];
    yield {
        stepNumber: step,
        entities: tree("", false),
        edges: [],
        description:
            "PNS tree: OR root over AND-node A (leaves W, L) and leaf B (W) – all numbers unevaluated.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { nodes: 5, root: "OR", winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("w1", false),
        edges: [],
        description: `Terminal winning leaves hold pn=0 with dn=${INF}; terminal losing leaf L holds pn=${INF} with dn=0.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { leafW, leafL },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("a", false),
        edges: [],
        description: `AND-node A sums proof: pn = 0+${INF} = ${andA[0]}, and takes min disproof dn = min(${INF}, 0) = ${andA[1]} – disproved via losing leaf L.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { andA },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("b", false),
        edges: [],
        description: `Leaf B is a proven win with pn=0 and dn=${INF} – a one-leaf proof for the OR root.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { leafB: leafW },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("root", false),
        edges: [],
        description: `OR root takes min proof pn = min(${andA[0]}, 0) = ${root[0]} – proved winning via leaf B.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { root, winning: true },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("", true),
        edges: [],
        description:
            "Root proof number is 0: the root position is proved winning, so search stops and reports first player wins.",
        codeLineNumber: 5,
        layout: "tree",
        meta: { root, proved: true, winner: "first", winning: true },
    };
}

const module: AlgorithmModule = {
    id: "proof-number-search",
    name: "Proof-Number Search",
    category: "game",
    complexity: { time: "O(nodes)", space: "O(nodes)" },
    defaultInput: { extra: false },
    visualType: "tree",
    run,
    pseudocode: [
        "start from the OR root over AND-node A and winning leaf B",
        "set terminal wins to pn 0 and losses to dn 0 for scoring",
        "evaluate AND-node A by sum of proof and min of disproof",
        "evaluate leaf B as a one-leaf proof for the OR root",
        "back up the OR root by min proof over children A and B",
        "winner is first player since the root proof number reaches 0",
    ],
};

export default module;
