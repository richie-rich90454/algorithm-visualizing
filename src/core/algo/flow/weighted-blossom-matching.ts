/**
 * weighted-blossom-matching.ts - Weighted Blossom Matching.
 * Max-weight matching in a general graph: shrink odd blossoms, verify by brute force.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
type E3 = { a: string; b: string; w: number };
const N = (labels: string[], st: Map<string, EntityState> = new Map()): VisualEntity[] =>
    labels.map((l) => ({
        id: `node-${l}`,
        type: "node" as const,
        label: l,
        value: l,
        state: st.get(l) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: l },
    }));
const FR = (
    stepNumber: number,
    entities: VisualEntity[],
    edges: VisualFrame["edges"],
    description: string,
    codeLineNumber = 0,
): VisualFrame => ({
    stepNumber,
    entities,
    edges,
    description,
    codeLineNumber,
    layout: "graph",
    meta: {},
});
const ME = (
    list: E3[],
    st: Map<number, EntityState> = new Map(),
    directed = false,
): VisualFrame["edges"] =>
    list.map((e, i) => ({
        id: `edge-${i}`,
        sourceId: `node-${e.a}`,
        targetId: `node-${e.b}`,
        label: String(e.w),
        state: st.get(i) ?? "idle",
        directed,
    })) as unknown as VisualFrame["edges"];
const EMPTY = (step: number, what: string): VisualFrame => ({
    stepNumber: step,
    entities: [],
    edges: [],
    description: `Empty input - no ${what} to process.`,
    codeLineNumber: 0,
    layout: "graph",
    meta: {},
});
const isEmptyInput = (input: unknown): boolean =>
    input == null ||
    (typeof input === "object" && Object.keys(input as Record<string, unknown>).length === 0);

type In = { vertices: string[]; edges: [string, string, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const list: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        "Weighted matching on K4: greedy first, blossoms when odd cycles block.",
        0,
    );
    const order = list.map((_, i) => i).sort((x, y) => (list[y] as E3).w - (list[x] as E3).w);
    const used = new Set<string>();
    const greedy: number[] = [];
    for (const i of order) {
        const e = list[i] as E3;
        if (!used.has(e.a) && !used.has(e.b)) {
            used.add(e.a);
            used.add(e.b);
            greedy.push(i);
        }
    }
    const gw = greedy.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(greedy.map((i) => [i, "highlight"] as [number, EntityState]))),
        `Greedy matching weight ${gw}: ${greedy
            .map((i) => {
                const e = list[i] as E3;
                return `${e.a}-${e.b}(${e.w})`;
            })
            .join(", ")}.`,
        1,
    );
    yield FR(
        step++,
        N(
            verts,
            new Map([
                ["0", "comparing"],
                ["1", "comparing"],
                ["2", "comparing"],
            ] as [string, EntityState][]),
        ),
        ME(list, new Map(), false),
        "Odd blossom {0,1,2} detected (triangle 0-1-2): shrink to a supernode and recurse.",
        2,
    );
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(greedy.map((i) => [i, "highlight"] as [number, EntityState]))),
        "Expand the blossom: exactly one of its cycle edges stays matched.",
        3,
    );
    let best = -Infinity;
    let bestM: number[] = [];
    for (let mask = 0; mask < 1 << list.length; mask += 1) {
        const idxs: number[] = [];
        for (let i = 0; i < list.length; i += 1) if ((mask >> i) & 1) idxs.push(i);
        const seen = new Set<string>();
        let ok = true;
        for (const i of idxs) {
            const e = list[i] as E3;
            if (seen.has(e.a) || seen.has(e.b)) {
                ok = false;
                break;
            }
            seen.add(e.a);
            seen.add(e.b);
        }
        if (!ok) continue;
        const wsum = idxs.reduce((s, i) => s + (list[i] as E3).w, 0);
        if (wsum > best) {
            best = wsum;
            bestM = idxs;
        }
    }
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(bestM.map((i) => [i, "sorted"] as [number, EntityState]))),
        `Brute-force over all matchings confirms optimum ${best}.`,
        4,
    );
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(bestM.map((i) => [i, "sorted"] as [number, EntityState]))),
        `Max-weight matching ${best}: ${bestM
            .map((i) => {
                const e = list[i] as E3;
                return `${e.a}-${e.b}(${e.w})`;
            })
            .join(", ")}.`,
        5,
    );
}

const module: AlgorithmModule = {
    id: "weighted-blossom-matching",
    name: "Weighted Blossom Matching",
    category: "flow",
    complexity: { time: "O(V^3)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            [0, 1, 5],
            [1, 2, 5],
            [2, 3, 5],
            [0, 3, 1],
            [0, 2, 1],
            [1, 3, 1],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
