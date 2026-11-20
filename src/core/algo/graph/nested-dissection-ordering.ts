/**
 * nested-dissection-ordering.ts - Nested Dissection Fill-Reducing Ordering
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Nested dissection orders the vertices of a graph so that sparse matrix
 * factorization creates little fill-in. It repeatedly peels off a small
 * separator: a breadth-first layer whose removal splits the remaining graph
 * into smaller pieces. Each piece is ordered recursively, and the separator
 * is placed last because eliminating it is what connects the pieces.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log(V) * (V + E)) for the separator layers used here
 *   Space: O(V + E) for adjacency, recursion records, and edge entities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Separator vertices of each recursion level get a distinct state color.
 *   - Edges touching the current separator are ORANGE, others are CYAN.
 *   - meta carries the final ordering and the separator sizes per level.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;
type Meta = Record<string, number | string | boolean>;
const STATE_CYCLE: EntityState[] = ["comparing", "active", "highlight", "pivot", "path", "sorted"];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Adj; leafSize?: number } | null) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "E", "F"],
        B: ["A", "C", "F"],
        C: ["B", "D", "G"],
        D: ["C", "G", "H"],
        E: ["A", "F", "I"],
        F: ["A", "B", "E", "J"],
        G: ["C", "D", "K"],
        H: ["D", "K", "L"],
        I: ["E", "J", "M"],
        J: ["F", "I", "N"],
        K: ["G", "H", "O"],
        L: ["H", "O", "P"],
        M: ["I", "N"],
        N: ["J", "M", "P"],
        O: ["K", "L"],
        P: ["L", "N"],
    };
    const leafSize = typeof task.leafSize === "number" ? Math.max(1, Math.floor(task.leafSize)) : 2;
    const vertices = Object.keys(adjacency).sort();
    const undirected = new Map<string, Set<string>>(vertices.map((v) => [v, new Set<string>()]));
    const edgeList: Array<[string, string]> = [];
    const seenEdge = new Set<string>();
    for (const a of vertices) {
        for (const b of adjacency[a] ?? []) {
            if (!adjacency[b] || a === b) continue;
            undirected.get(a)?.add(b);
            undirected.get(b)?.add(a);
            const key = [a, b].sort().join("|");
            if (seenEdge.has(key)) continue;
            seenEdge.add(key);
            edgeList.push([a, b]);
        }
    }

    let step = 0;
    const levels = new Map<string, number>();
    const frameAt = (description: string, line: number, separator: string[], meta: Meta): VisualFrame => {
        const sep = new Set(separator);
        const nodes = makeGraphNodes(vertices).map((n) => {
            const v = String(n.value);
            n.state = levels.has(v) ? STATE_CYCLE[(levels.get(v) as number) % STATE_CYCLE.length] : "unvisited";
            n.metadata["level"] = levels.get(v) ?? -1;
            n.metadata["separator"] = sep.has(v);
            return n;
        });
        const edges = edgeList.map(([a, b]) => ({
            id: `edge-${[a, b].sort().join("-")}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: sep.has(a) || sep.has(b) ? ("swapped" as const) : ("path" as const),
            directed: false,
        }));
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph" as const,
            meta,
        };
    };

    if (vertices.length === 0) {
        yield frameAt("Empty graph - the ordering is empty.", 0, [], {
            order: "",
            separatorCount: 0,
            orderSize: 0,
        });
        return;
    }

    const frames: VisualFrame[] = [];
    const records: Array<{ size: number; separator: string[]; components: string[][] }> = [];
    let separatorCount = 0;
    const emit = (description: string, separator: string[], meta: Meta): void => {
        frames.push(frameAt(description, 3, separator, meta));
        step += 1;
    };

    const bfsLevels = (subset: Set<string>): Map<string, number> => {
        const result = new Map<string, number>();
        const root = [...subset][0] as string;
        result.set(root, 0);
        const queue = [root];
        while (queue.length > 0) {
            const u = queue.shift() as string;
            const d = result.get(u) as number;
            for (const v of undirected.get(u) ?? []) {
                if (subset.has(v) && !result.has(v)) {
                    result.set(v, d + 1);
                    queue.push(v);
                }
            }
        }
        return result;
    };

    const componentsOf = (subset: Set<string>): string[][] => {
        const visited = new Set<string>();
        const out: string[][] = [];
        for (const start of subset) {
            if (visited.has(start)) continue;
            const comp: string[] = [];
            const stack = [start];
            visited.add(start);
            while (stack.length > 0) {
                const u = stack.pop() as string;
                comp.push(u);
                for (const v of undirected.get(u) ?? []) {
                    if (subset.has(v) && !visited.has(v)) {
                        visited.add(v);
                        stack.push(v);
                    }
                }
            }
            out.push(comp.sort());
        }
        return out;
    };

    const chooseSeparator = (subset: Set<string>, lv: Map<string, number>): string[] => {
        const maxLevel = Math.max(...lv.values());
        let layer = [...lv.entries()].filter(([, d]) => d === Math.ceil(maxLevel / 2)).map(([v]) => v);
        if (layer.length === 0 || layer.length === subset.size) {
            let bestSize = -1;
            for (let d = 0; d <= maxLevel; d += 1) {
                const cand = [...lv.entries()].filter(([, x]) => x === d).map(([v]) => v);
                if (cand.length > bestSize && cand.length < subset.size) {
                    bestSize = cand.length;
                    layer = cand;
                }
            }
        }
        if (layer.length === 0 || layer.length === subset.size) {
            let bestDeg = -1;
            for (const v of subset) {
                const deg = undirected.get(v)?.size ?? 0;
                if (deg > bestDeg) {
                    bestDeg = deg;
                    layer = [v];
                }
            }
        }
        return layer.sort();
    };

    const dissect = (subsetInput: string[], depth: number): string[] => {
        const subset = new Set(subsetInput);
        if (subset.size <= leafSize) return [...subset].sort();
        const separator = chooseSeparator(subset, bfsLevels(subset));
        for (const v of separator) levels.set(v, depth);
        const remaining = new Set([...subset].filter((v) => !separator.includes(v)));
        const components = componentsOf(remaining);
        records.push({ size: subset.size, separator, components });
        separatorCount += 1;
        emit(
            `Level ${depth}: separator [${separator.join(", ")}] splits ${subset.size} vertices into ${components.length} piece(s).`,
            separator,
            { order: "", separatorCount, orderSize: 0, currentLevel: depth, separator: separator.join(",") },
        );
        const order: string[] = [];
        for (const component of components) order.push(...dissect(component, depth + 1));
        order.push(...separator);
        return order;
    };

    const order = dissect(vertices, 0);
    for (const frame of frames) yield frame;
    yield frameAt(
        `Nested dissection produced an ordering of ${order.length} vertices using ${separatorCount} separator(s).`,
        7,
        [],
        {
            order: order.join(","),
            separatorCount,
            orderSize: order.length,
            separatorSizes: records.map((r) => r.separator.length).join(","),
            componentCounts: records.map((r) => r.components.length).join(","),
            subgraphSizes: records.map((r) => r.size).join(","),
            separatorSets: records.map((r) => r.separator.join("+")).join("|"),
            componentSets: records
                .map((r) => r.components.map((c) => c.join("+")).join("/"))
                .join("|"),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Eliminating a vertex in a sparse factorization tends to connect all of its neighbors, creating new nonzero entries called fill. If a small set of vertices breaks the graph into separate pieces, eliminate those pieces first and the separator last, so the new connections cannot spread between pieces.",
        invariants: [
            "A separator and the pieces it creates are disjoint and together cover the current subgraph.",
            "Each recursive piece is strictly smaller than its parent subgraph.",
            "The final ordering lists every vertex exactly once.",
        ],
        correctness:
            "Removing a separator disconnects the remaining vertices into independent components. No edge joins different components, so eliminating one component can never create fill entries in another. Placing each component's ordering before the separator therefore confines all fill-in to the separator, and induction on subgraph size shows the ordering is a permutation of the vertices with separators last at every level.",
        complexityRationale:
            "A breadth-first scan of a subgraph costs O(V + E) and a balanced layer leaves pieces of at most constant fraction of the vertices, so the recursion has O(log V) levels and costs O(log V * (V + E)) time. Storing adjacency and recursion records uses O(V + E) space.",
        uses: [
            "Ordering unknowns in sparse Cholesky factorization",
            "Making finite-element meshes faster to solve in parallel",
            "Reducing fill in circuit simulation matrices",
        ],
        references: [
            "George, Nested Dissection of a Regular Finite Element Mesh, 1973",
            "Lipton, Rose and Tarjan, Generalized Nested Dissection, 1979",
        ],
        workedExample:
            "On a grid of vertices the middle row is a separator. Removing it leaves a top and a bottom grid; each is ordered recursively and the middle row is appended last, so factorization fill stays within the separator instead of spreading across the whole grid.",
    },
    id: "nested-dissection-ordering",
    name: "Nested Dissection Ordering",
    category: "graph",
    complexity: { time: "O(log V (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "E", "F"],
            B: ["A", "C", "F"],
            C: ["B", "D", "G"],
            D: ["C", "G", "H"],
            E: ["A", "F", "I"],
            F: ["A", "B", "E", "J"],
            G: ["C", "D", "K"],
            H: ["D", "K", "L"],
            I: ["E", "J", "M"],
            J: ["F", "I", "N"],
            K: ["G", "H", "O"],
            L: ["H", "O", "P"],
            M: ["I", "N"],
            N: ["J", "M", "P"],
            O: ["K", "L"],
            P: ["L", "N"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected adjacency and start at the whole graph",
        "if the piece is small enough, append it and return",
        "run breadth-first search and record vertex levels",
        "pick a middle level as the separator of this piece",
        "remove the separator and find connected components",
        "order each component recursively before the separator",
        "record the separator and its component sizes",
        "stop when every piece has been reduced to a leaf",
        "done: output the fill-reducing vertex ordering",
    ],
};

export default module;
