// proof-number-search.ts – Proof-Number Search on a tiny AND/OR tree.
// OR root: A=AND(W,L), B=W leaf. Proof/disproof numbers use the standard
// rules (OR: min/sum; AND: sum/min); the root proves (pn 0), computed live.
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
        description: "PNS tree: OR root over AND-node A (leaves W, L) and leaf B (W).",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("w1", false),
        edges: [],
        description: `Terminal W: pn=0, dn=${INF}. Terminal L: pn=${INF}, dn=0.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { leafW, leafL },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("a", false),
        edges: [],
        description: `AND-node A: pn = 0+${INF} = ${andA[0]}, dn = min(${INF}, 0) = ${andA[1]} – disproved via L.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { andA },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("b", false),
        edges: [],
        description: `Leaf B is a win: pn=0, dn=${INF} – one proof for the OR root.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { leafB: leafW },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("root", false),
        edges: [],
        description: `OR root: pn = min(${andA[0]}, 0) = ${root[0]} – proved via B.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { root },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: tree("", true),
        edges: [],
        description: "Root pn is 0: the position is proved winning; search stops.",
        codeLineNumber: 4,
        layout: "tree",
        meta: { root, proved: true },
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
};

export default module;
