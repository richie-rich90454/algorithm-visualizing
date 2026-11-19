/**
 * dynamic-connectivity.ts - Offline Dynamic Connectivity
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When the full update log is known in advance, connectivity over time can be
 * answered with a segment tree whose nodes hold the edges active across a time
 * range. A depth-first walk applies each range's edges to a rollback union-find,
 * records the components at the leaves, and undoes the unions on the way back.
 * Each edge is stored in only O(log T) nodes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((E log T + V T) alpha(V)) including the component snapshots
 *   Space: O(E log T + V T) for the segment tree and the recorded answers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A frame is shown per query time with only that time's edges active.
 *   - Nodes of one connected component share a palette color.
 *   - meta reports the current time and the component root of every vertex.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface TimedEdge {
    u: string;
    v: string;
    start: number;
    end: number;
}

const COMPONENT_STATES: EntityState[] = [
    "active",
    "comparing",
    "swapped",
    "path",
    "highlight",
    "visited",
    "pivot",
    "sorted",
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            vertices?: string[];
            edges?: TimedEdge[];
            times?: number[];
        } | null) ?? {};
    const edges: TimedEdge[] = task.edges ?? [
        { u: "A", v: "B", start: 0, end: 2 },
        { u: "B", v: "C", start: 1, end: 3 },
        { u: "C", v: "D", start: 2, end: 4 },
        { u: "A", v: "D", start: 0, end: 1 },
    ];
    const times: number[] = task.times ?? [0, 1, 2, 3, 4];
    const labels = [
        ...new Set([
            ...(task.vertices ?? []),
            ...edges.flatMap((e) => [e.u, e.v]).map(String),
        ]),
    ].sort();
    const index = new Map(labels.map((v, i) => [v, i] as const));
    const T = times.length;

    const frames: VisualFrame[] = [];
    const componentsAt: number[][] = Array.from({ length: T }, () => Array<number>(labels.length).fill(-1));

    const push = (
        description: string,
        line: number,
        timeIndex: number,
        components: number[],
    ): void => {
        const nodes: VisualEntity[] = makeGraphNodes(labels);
        nodes.forEach((node, i) => {
            const root = components[i] ?? -1;
            node.state = root < 0
                ? "unvisited"
                : (COMPONENT_STATES[root % COMPONENT_STATES.length] as EntityState);
            node.metadata = { ...node.metadata, component: root };
        });
        const visualEdges: VisualEdge[] = [];
        if (timeIndex >= 0) {
            edges.forEach((e, i) => {
                if (e.start <= timeIndex && timeIndex <= e.end) {
                    visualEdges.push({
                        id: `timed-edge-${i}`,
                        sourceId: `node-${e.u}`,
                        targetId: `node-${e.v}`,
                        label: `${e.start}-${e.end}`,
                        state: "active",
                        directed: false,
                    });
                }
            });
        }
        frames.push({
            stepNumber: frames.length,
            entities: nodes,
            edges: visualEdges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                time: timeIndex >= 0 ? (times[timeIndex] as number) : -1,
                components: [...components],
                activeEdges: visualEdges.length,
            },
        });
    };

    if (labels.length === 0 || T === 0) {
        push("No vertices or query times - nothing to answer.", 0, -1, []);
        for (const frame of frames) {
            yield frame;
        }
        return;
    }

    push("Offline dynamic connectivity: segment tree over query times with rollback union-find.", 0, -1, []);

    const seg: number[][] = Array.from({ length: 4 * T }, () => []);
    const addRange = (node: number, L: number, R: number, qL: number, qR: number, edgeIdx: number): void => {
        if (qL > qR || qL > R || qR < L) {
            return;
        }
        if (qL <= L && R <= qR) {
            seg[node]?.push(edgeIdx);
            return;
        }
        const mid = (L + R) >> 1;
        addRange(node * 2, L, mid, qL, qR, edgeIdx);
        addRange(node * 2 + 1, mid + 1, R, qL, qR, edgeIdx);
    };
    edges.forEach((e, i) => {
        const a = Math.max(0, Math.min(T - 1, e.start));
        const b = Math.max(0, Math.min(T - 1, e.end));
        if (a <= b) {
            addRange(1, 0, T - 1, a, b, i);
        }
    });

    const dsuParent = Array.from({ length: labels.length }, (_v, i) => i);
    const dsuSize = Array<number>(labels.length).fill(1);
    const history: Array<{ child: number; root: number; size: number }> = [];
    const find = (x: number): number => {
        while (dsuParent[x] !== x) {
            x = dsuParent[x] as number;
        }
        return x;
    };
    const unite = (a: number, b: number): void => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) {
            return;
        }
        let child = rb;
        let root = ra;
        if ((dsuSize[ra] as number) < (dsuSize[rb] as number)) {
            child = ra;
            root = rb;
        }
        history.push({ child, root, size: dsuSize[root] as number });
        dsuParent[child] = root;
        dsuSize[root] = (dsuSize[root] as number) + (dsuSize[child] as number);
    };
    const rollback = (snapshot: number): void => {
        while (history.length > snapshot) {
            const change = history.pop() as { child: number; root: number; size: number };
            dsuParent[change.child] = change.child;
            dsuSize[change.root] = change.size;
        }
    };

    const walk = (node: number, L: number, R: number): void => {
        const snapshot = history.length;
        for (const edgeIdx of seg[node] ?? []) {
            const e = edges[edgeIdx];
            if (!e) {
                continue;
            }
            const u = index.get(String(e.u));
            const v = index.get(String(e.v));
            if (u !== undefined && v !== undefined) {
                unite(u, v);
            }
        }
        if (L === R) {
            componentsAt[L] = labels.map((_v, i) => find(i));
        } else {
            const mid = (L + R) >> 1;
            walk(node * 2, L, mid);
            walk(node * 2 + 1, mid + 1, R);
        }
        rollback(snapshot);
    };
    walk(1, 0, T - 1);

    componentsAt.forEach((components, t) => {
        push(
            `Time ${times[t]}: ${edges.filter((e) => e.start <= t && t <= e.end).length} active edge(s), components recorded.`,
            5,
            t,
            components,
        );
    });

    push(`Answered connectivity at ${T} query time(s).`, 7, -1, componentsAt[T - 1] ?? []);

    for (const frame of frames) {
        yield frame;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An edge that lives from time l to time r only matters at those leaves of a segment tree built over the query times, and it can be attached to a small number of tree nodes that exactly cover that range. Walking the tree from the root, we union the edges stored at each node and arrive at a leaf with exactly the edges active then. Undoing the unions when we backtrack lets sibling ranges reuse the same union-find.",
        invariants: [
            "At a leaf, the union-find contains precisely the edges active at that time.",
            "Rollback restores the union-find to its state before entering each segment-tree node.",
            "Two vertices share a component exactly when a chain of active edges joins them.",
        ],
        correctness:
            "The range decomposition assigns an edge to disjoint segment-tree nodes whose union is exactly its active time interval, so every leaf on that interval receives the edge and no other leaf does. A rollback union-find maintains connected components under the pushed unions, so the component labeling at a leaf is the true connectivity for that time. Backtracking restores state, preventing one leaf's edges from leaking into another.",
        complexityRationale:
            "Each of the E edges is placed in O(log T) segment nodes and unioned once per placement, giving O(E log T alpha(V)) update work. Recording V component labels at each of T leaves adds O(V T), and the segment tree plus stored answers use O(E log T + V T) space.",
        uses: [
            "Answering connectivity questions over a known schedule of link failures",
            "Analyzing dynamic networks and incremental constraint systems",
            "Offline preprocessing for temporal graph queries",
        ],
        references: [
            "cp-algorithms.com, Offline dynamic connectivity",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on disjoint sets",
        ],
        workedExample:
            "With times 0 through 4, edge A-B active on 0-2, B-C on 1-3, C-D on 2-4, and A-D on 0-1, time 1 connects all four vertices through A-B, B-C and A-D, while time 4 leaves A isolated because only C-D remains. The rollback walk records both answers without rebuilding the graph per query.",
    },
    id: "dynamic-connectivity",
    name: "Offline Dynamic Connectivity",
    category: "graph",
    complexity: { time: "O((E log T + V T) alpha(V))", space: "O(E log T + V T)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            { u: "A", v: "B", start: 0, end: 2 },
            { u: "B", v: "C", start: 1, end: 3 },
            { u: "C", v: "D", start: 2, end: 4 },
            { u: "A", v: "D", start: 0, end: 1 },
        ],
        times: [0, 1, 2, 3, 4],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build a segment tree over the query time indices",
        "place each timed edge in the nodes covering its active interval",
        "start a rollback union-find with every vertex separate",
        "at each segment node, union the edges stored there",
        "at a leaf, record the component root of every vertex",
        "recurse into both children of the node",
        "roll back all unions made at this node before returning",
        "report the component labels at every query time",
    ],
};

export default module;
