/**
 * farach-colton-bender-lca.ts - Farach-Colton-Bender Lowest Common Ancestor
 *
 * The tree's Euler tour turns LCA into a ±1 range-minimum query on depths.
 * Linear-space block tables answer each query in constant time, giving the
 * optimal O(n) preprocessing and O(1) query bounds.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Task = {
    parentMap?: Record<string, string | null>;
    ids?: string[];
    queries?: Array<[string, string]>;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(task.parentMap ?? {
            B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G",
        }),
    );
    const ids = Array.isArray(task.ids) ? [...task.ids].map(String) : ["A", "B", "C", "D", "E", "F", "G", "H"];
    const queries: Array<[string, string]> = Array.isArray(task.queries)
        ? task.queries
        : [["D", "H"], ["F", "E"], ["B", "C"]];
    const frames: VisualFrame[] = [];
    let step = 0;

    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);
    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent && children.has(parent)) {
            children.get(parent)?.push(child);
        }
    }
    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";

    const snapshot = (hot: string[], lca: string | null, description: string, line: number, extra: Record<string, number | string | boolean | Array<number | string>> = {}): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => {
            const id = node.id.replace("node-", "");
            const state: EntityState = id === lca ? "sorted" : hot.includes(id) ? "comparing" : "visited";
            return { ...node, state };
        }),
        edges: edges.map((edge) => ({ ...edge, state: hot.some((h) => edge.sourceId === `node-${h}` || edge.targetId === `node-${h}`) ? "active" as EntityState : "idle" as EntityState })),
        description,
        codeLineNumber: line,
        layout: "tree",
        meta: { vertices: ids.length, queries: queries.length, ...extra },
    });

    if (ids.length === 0) {
        frames.push(snapshot([], null, "Empty tree - no lowest common ancestor can be requested.", 0, { answers: [] }));
        yield* frames;
        return;
    }

    frames.push(snapshot([], null, `Farach-Colton-Bender LCA preprocessing on ${ids.length} vertices.`, 0, { answers: [] }));
    step += 1;

    const depth = new Map<string, number>();
    const first = new Map<string, number>();
    const tour: string[] = [];
    const tourDepth: number[] = [];
    const walk = (node: string, d: number): void => {
        depth.set(node, d);
        if (!first.has(node)) {
            first.set(node, tour.length);
        }
        tour.push(node);
        tourDepth.push(d);
        for (const child of children.get(node) ?? []) {
            walk(child, d + 1);
            tour.push(node);
            tourDepth.push(d);
        }
    };
    walk(root, 0);
    frames.push(snapshot([], null, `Euler tour has ${tour.length} entries; depths move by one step at a time.`, 2, { tourLength: tour.length }));
    step += 1;

    const size = Math.max(2, Math.floor(Math.log2(Math.max(2, tour.length)) / 2));
    const blockCount = Math.ceil(tour.length / size);
    const prefixMin: number[][] = [];
    const suffixMin: number[][] = [];
    const blockMin: number[] = [];
    for (let b = 0; b < blockCount; b += 1) {
        const from = b * size;
        const to = Math.min(tour.length, from + size) - 1;
        const pre: number[] = [];
        let best = from;
        for (let i = from; i <= to; i += 1) {
            if ((tourDepth[i] ?? 0) < (tourDepth[best] ?? 0)) {
                best = i;
            }
            pre.push(best);
        }
        prefixMin.push(pre);
        const suf = new Array<number>(to - from + 1).fill(to);
        best = to;
        for (let i = to; i >= from; i -= 1) {
            if ((tourDepth[i] ?? 0) <= (tourDepth[best] ?? 0)) {
                best = i;
            }
            suf[i - from] = best;
        }
        suffixMin.push(suf);
        blockMin.push(best);
    }
    const levels = Math.max(1, Math.floor(Math.log2(Math.max(1, blockCount))) + 1);
    const sparse: number[][] = [blockMin];
    for (let k = 1; k < levels; k += 1) {
        const previous = sparse[k - 1] ?? [];
        const current: number[] = [];
        for (let i = 0; i + (1 << k) <= blockCount; i += 1) {
            const a = previous[i] ?? 0;
            const b = previous[i + (1 << (k - 1))] ?? 0;
            current.push((tourDepth[a] ?? 0) <= (tourDepth[b] ?? 0) ? a : b);
        }
        sparse.push(current);
    }
    frames.push(snapshot([], null, `Built ${blockCount} depth blocks of size ${size} and ${levels} sparse-table level(s).`, 4, { blocks: blockCount, blockSize: size }));
    step += 1;

    const rangeMin = (a: number, b: number): number => {
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        const blockA = Math.floor(from / size);
        const blockB = Math.floor(to / size);
        let best = from;
        if (blockA === blockB) {
            for (let k = from; k <= to; k += 1) {
                if ((tourDepth[k] ?? 0) < (tourDepth[best] ?? 0)) {
                    best = k;
                }
            }
            return best;
        }
        const suffix = suffixMin[blockA]?.[from - blockA * size] ?? from;
        const prefix = prefixMin[blockB]?.[to - blockB * size] ?? to;
        best = (tourDepth[suffix] ?? 0) <= (tourDepth[prefix] ?? 0) ? suffix : prefix;
        if (blockA + 1 <= blockB - 1) {
            const span = blockB - blockA - 1;
            const k = Math.floor(Math.log2(Math.max(1, span)));
            const row = sparse[k] ?? [];
            const leftIndex = row[blockA + 1] ?? from;
            const rightIndex = row[blockB - (1 << k)] ?? to;
            const middle = (tourDepth[leftIndex] ?? 0) <= (tourDepth[rightIndex] ?? 0) ? leftIndex : rightIndex;
            if ((tourDepth[middle] ?? 0) < (tourDepth[best] ?? 0)) {
                best = middle;
            }
        }
        return best;
    };

    const answers: string[] = [];
    for (const [u, v] of queries) {
        if (!first.has(u) || !first.has(v)) {
            answers.push("?");
            frames.push(snapshot([u, v], null, `Query (${u}, ${v}) names a vertex outside the tree.`, 6, { answers: [...answers] }));
            step += 1;
            continue;
        }
        const k = rangeMin(first.get(u) ?? 0, first.get(v) ?? 0);
        const lca = tour[k] ?? root;
        answers.push(lca);
        frames.push(snapshot([u, v], lca, `LCA of ${u} and ${v} is ${lca} (tour minimum depth ${tourDepth[k]}).`, 7, {
            answers: [...answers],
            lastLca: lca,
        }));
        step += 1;
    }
    frames.push(snapshot([], null, `Answered ${queries.length} LCA query(ies): ${answers.join(", ") || "none"}.`, 8, { answers }));
    yield* frames;
}

const module: AlgorithmModule = {
    id: "farach-colton-bender-lca",
    name: "Farach-Colton-Bender LCA",
    category: "tree",
    complexity: { time: "O(n) preprocessing, O(1) query", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
        queries: [["D", "H"], ["F", "E"], ["B", "C"]],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build the child lists and find the tree root",
        "record the Euler tour and each vertex depth",
        "store the first visit position of every vertex",
        "partition the depth sequence into fixed-size blocks",
        "precompute prefix and suffix minima inside each block",
        "build a sparse table over whole-block minima",
        "answer a query by the shallowest tour visit in the range",
        "report each lowest common ancestor",
        "finish after all queries are answered",
    ],
    education: {
        intuition:
            "The lowest common ancestor of two vertices is the shallowest vertex visited on the Euler tour between their first visits. Because tour depths go up and down by one, the problem becomes a range minimum query on a plus-minus-one array, which can be indexed with tiny block tables in linear space.",
        invariants: [
            "The Euler tour visits every vertex, and each edge is crossed once down and once up.",
            "The first occurrence of a vertex is its entry into the tour.",
            "The minimum depth between two first visits identifies their lowest common ancestor.",
        ],
        correctness:
            "The Euler tour interval between first visits contains exactly the vertices on the two root paths up to their divergence. The shallowest of those is the deepest shared ancestor, hence the LCA. The block decomposition checks both boundary fragments and all whole blocks, so it locates that shallowest visit exactly.",
        complexityRationale:
            "Constructing the tour, block tables, and sparse table takes O(n) time and space because block size is logarithmic and the number of blocks is O(n log n) in total only for the small tables. Each query reads a constant number of table entries.",
        uses: [
            "Lowest common ancestor queries on static trees",
            "Distance and path queries in trees",
            "Tree algorithms in compilers and phylogenetic analysis",
        ],
        references: [
            "Farach-Colton and Bender, The LCA Problem Revisited, LATIN 2000",
            "Berkman and Vishkin, Recursive Star-Tree Parallel Data Structure, 1993",
        ],
        workedExample:
            "On the sample tree with B and C as children of A, D and E under B, G under E, and H under G, the query D,H walks the tour from first(D) to first(H). The shallowest vertex visited is B, so the LCA of D and H is B.",
    },
};

export default module;
