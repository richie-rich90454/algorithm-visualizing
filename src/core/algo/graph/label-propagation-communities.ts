/**
 * label-propagation-communities.ts – Label Propagation Communities
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Communities are groups with dense inside links and sparse outside links.
 * Label propagation finds them with almost no machinery: every vertex
 * starts with a unique label, then each vertex repeatedly adopts the most
 * frequent label among its neighbors. Dense groups quickly collapse onto
 * one shared label while sparse bridges fail to convert either side. On
 * the barbell the halves settle into {A,B,C} and {D,E,F}.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k·(V + E)) – k sweep rounds over all edges
 *   Space: O(V + E) for labels and adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex adopting a label is YELLOW (comparing).
 *   - Neighbors carrying the adopted label show GREEN (sorted).
 *   - Each final community gets its own color.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Nearly linear and parameter-free, but ties make it nondeterministic.
 *   - A fast first pass before heavier methods like Louvain.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C", "E", "F"],
        E: ["D", "F"],
        F: ["D", "E"],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const label = new Map(labels.map((v, i) => [v, i]));
    yield snap("Each vertex starts with a unique label.", 0, { communities: labels.length });
    step += 1;
    let round = 0;
    let changed = true;
    while (changed && round < 10) {
        changed = false;
        round += 1;
        for (const v of labels) {
            const freq = new Map<number, number>();
            for (const nb of adjacency[v] ?? [])
                freq.set(label.get(nb) as number, (freq.get(label.get(nb) as number) ?? 0) + 1);
            if (freq.size === 0) continue;
            const top = Math.max(...freq.values());
            const cands = [...freq.entries()].filter(([, n]) => n === top).map(([l]) => l);
            const pick = Math.max(...cands);
            if (pick !== label.get(v)) {
                label.set(v, pick);
                changed = true;
                clr();
                setN(v, "comparing");
                for (const nb of adjacency[v] ?? [])
                    if (label.get(nb) === pick) {
                        setN(nb, "sorted");
                        setE(v, nb, "active");
                        setE(nb, v, "active");
                    }
                yield snap(`Round ${round}: ${v} adopts label ${pick} from its neighbors.`, 1, {
                    round,
                });
                step += 1;
            }
        }
    }
    yield snap(`Stable after ${round} round(s): reading community labels.`, 2, { rounds: round });
    step += 1;
    const groups = new Map<number, string[]>();
    for (const v of labels) {
        const l = label.get(v) as number;
        if (!groups.has(l)) groups.set(l, []);
        (groups.get(l) as string[]).push(v);
    }
    clr();
    const palette: EntityState[] = ["sorted", "visited", "highlight"];
    let gi = 0;
    for (const members of groups.values()) {
        for (const m of members) setN(m, palette[gi % palette.length] as EntityState);
        gi += 1;
    }
    yield snap(
        `Communities: ${[...groups.values()].map((m) => `{${m.sort().join(",")}}`).join(" ")}.`,
        4,
        { communities: groups.size },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Label propagation is a strikingly simple community detector. Every vertex starts with a unique label, then each sweep updates every vertex to the most frequent label among its neighbors. Dense groups quickly agree on one label while sparse bridges fail to convert either side.",
        "invariants": [
            "A vertex's label is always one that appeared among its neighbors or its own previous label.",
            "Labels never split a dense group once it has converged.",
            "The process stops when a full sweep changes no label."
        ],
        "correctness": "The update is a local majority rule that increases agreement along dense internal edges and is resisted across sparse bridges. When a fixed point is reached, every vertex's label matches the local majority, so the resulting groups are stable communities under the method's definition, even though the algorithm is heuristic rather than optimizing a global objective.",
        "complexityRationale": "Each sweep scans all edges once, O(V + E), and the number of sweeps k is usually small, giving O(k(V + E)); labels and adjacency use O(V + E) space.",
        "uses": [
            "Fast community detection in very large networks",
            "A baseline for comparing modularity-based methods",
            "Clustering users in social and citation graphs"
        ],
        "references": [
            "Raghavan, Albert, and Kumara, Near Linear Time Algorithm to Detect Community Structures in Large-Scale Networks (2007)",
            "Newman, Networks: An Introduction, community detection chapter"
        ],
        "workedExample": "The barbell graph has two triangles joined by one edge. Starting from unique labels, the left triangle quickly settles on one shared label and the right on another; the bridge edge is too sparse to flip either side, yielding communities {A,B,C} and {D,E,F}."
    },
    id: "label-propagation-communities",
    name: "Label Propagation Communities",
    category: "graph",
    complexity: { time: "O(k·(V + E))", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["C", "E", "F"],
            E: ["D", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "give every vertex its own unique label",
        "each vertex adopts its neighbors' most frequent label",
        "repeat full sweeps until no vertex changes label",
        "group vertices that share a label into communities",
        "done: communities such as {A,B,C} and {D,E,F}",
    ],
};

export default module;
