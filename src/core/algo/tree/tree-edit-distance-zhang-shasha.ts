/**
 * tree-edit-distance-zhang-shasha.ts - Zhang-Shasha ordered tree edit distance
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The edit distance between two ordered, labeled trees is the minimum number
 * of node relabels, insertions and deletions that turn one tree into the other.
 * Zhang and Shasha number nodes in postorder, record for each node its
 * leftmost leaf descendant, and compute a forest DP only over the ranges that
 * are keyroot subtrees. A rename of two internal nodes adds the edit distance
 * of their children forests, which is already available from the same table.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m * min(depth, n) * min(depth, m)) in the classic form;
 *          O(n * m) turns for the keyroot ranges used here
 *   Space: O(n * m) for the memoized forest distances
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Both trees are drawn side by side in the tree layout.
 *   - The two subtrees whose forests are being compared are highlighted.
 *   - Each completed keyroot cell is reported in the meta string list.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type TreeSpec = {
    ids?: string[];
    parentMap?: Record<string, string | null>;
    labels?: Record<string, string>;
};

type NumberedTree = {
    ids: string[];
    labels: string[];
    left: number[];
    parent: number[];
    children: number[][];
    root: number;
};

function numberTree(spec: TreeSpec | undefined, fallback: TreeSpec): NumberedTree {
    const source = spec ?? fallback;
    const ids = source.ids ?? Object.keys(source.parentMap ?? {});
    const parentOf = new Map<string, string | null>();
    for (const id of ids) {
        parentOf.set(id, source.parentMap?.[id] ?? null);
    }
    const childrenOf = new Map<string, string[]>();
    for (const id of ids) {
        childrenOf.set(id, []);
    }
    for (const id of ids) {
        const p = parentOf.get(id);
        if (p && childrenOf.has(p)) {
            childrenOf.get(p)?.push(id);
        }
    }
    const rootId = ids.find((id) => parentOf.get(id) === null) ?? ids[0] ?? "n0";

    const index = new Map<string, number>();
    const labels: string[] = [];
    const parent: number[] = [];
    const children: number[][] = [];
    const left: number[] = [];
    let counter = 0;

    const visit = (id: string): number => {
        const childIndices: number[] = [];
        for (const child of childrenOf.get(id) ?? []) {
            childIndices.push(visit(child));
        }
        const own = ++counter;
        index.set(id, own);
        labels[own] = source.labels?.[id] ?? id;
        parent[own] = 0;
        children[own] = childIndices;
        left[own] = childIndices.length > 0 ? (left[childIndices[0] as number] ?? own) : own;
        return own;
    };
    const root = visit(rootId);
    for (const id of ids) {
        const own = index.get(id) ?? 0;
        const p = parentOf.get(id);
        parent[own] = p ? (index.get(p) ?? 0) : 0;
    }

    const orderedIds = ids.slice().sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0));
    return { ids: orderedIds, labels, left, parent, children, root };
}

function keyroots(tree: NumberedTree): number[] {
    const seen = new Set<number>();
    const roots: number[] = [];
    for (let i = 1; i < tree.left.length; i += 1) {
        const l = tree.left[i] ?? i;
        if (!seen.has(l)) {
            seen.add(l);
            roots.push(i);
        }
    }
    return roots;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { treeA?: TreeSpec; treeB?: TreeSpec } | null) ?? {};
    const fallbackA: TreeSpec = {
        ids: ["A", "B", "C", "D"],
        parentMap: { A: null, B: "A", C: "B", D: "C" },
        labels: { A: "a", B: "b", C: "c", D: "d" },
    };
    const fallbackB: TreeSpec = {
        ids: ["W", "X", "Y", "Z"],
        parentMap: { W: null, X: "W", Y: "X", Z: "W" },
        labels: { W: "a", X: "b", Y: "c", Z: "d" },
    };
    const treeA = numberTree(task.treeA, fallbackA);
    const treeB = numberTree(task.treeB, fallbackB);
    const n = treeA.ids.length;
    const m = treeB.ids.length;

    const memo = new Map<string, number>();
    const cells: string[] = [];
    const cellEvents: Array<{ i: number; j: number; value: number }> = [];

    const dist = (i1: number, i2: number, j1: number, j2: number): number => {
        if (i1 > i2 && j1 > j2) {
            return 0;
        }
        if (i1 > i2) {
            return j2 - j1 + 1;
        }
        if (j1 > j2) {
            return i2 - i1 + 1;
        }
        const key = `${i1},${i2},${j1},${j2}`;
        const cached = memo.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const a = i2;
        const b = j2;
        let best = dist(i1, a - 1, j1, j2) + 1;
        best = Math.min(best, dist(i1, i2, j1, b - 1) + 1);
        const la = treeA.left[a] ?? a;
        const lb = treeB.left[b] ?? b;
        const rename =
            dist(i1, la - 1, j1, lb - 1) +
            ((treeA.labels[a] ?? "") === (treeB.labels[b] ?? "") ? 0 : 1) +
            dist(la, a - 1, lb, b - 1);
        best = Math.min(best, rename);
        memo.set(key, best);

        if (i1 === la && j1 === lb) {
            cells.push(`D[${a},${b}]=${best}`);
            cellEvents.push({ i: a, j: b, value: best });
        }
        return best;
    };

    let step = 0;
    const nodesFor = (tree: NumberedTree, hi: Set<number>, lo: Set<number>, states: Map<number, EntityState>): VisualEntity[] => {
        const result: VisualEntity[] = [];
        for (let i = 1; i <= tree.ids.length; i += 1) {
            const id = tree.ids[i - 1] ?? `n${i}`;
            const parent = tree.parent[i] ?? 0;
            result.push({
                id: `node-${id}`,
                type: "node" as const,
                label: `${id}:${tree.labels[i] ?? id}`,
                value: tree.labels[i] ?? id,
                state: states.get(i) ?? (hi.has(i) ? "active" : lo.has(i) ? "comparing" : "unvisited"),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parent === 0 ? "root" : (tree.ids[parent - 1] ?? "root") },
            });
        }
        return result;
    };

    const edgesFor = (tree: NumberedTree): VisualEdge[] => {
        const result: VisualEdge[] = [];
        for (let i = 1; i <= tree.ids.length; i += 1) {
            const parent = tree.parent[i] ?? 0;
            if (parent === 0) {
                continue;
            }
            result.push({
                id: `edge-${tree.ids[parent - 1]}-${tree.ids[i - 1]}`,
                sourceId: `node-${tree.ids[parent - 1]}`,
                targetId: `node-${tree.ids[i - 1]}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            });
        }
        return result;
    };

    const frame = (hiA: Set<number>, hiB: Set<number>, description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: [...nodesFor(treeA, hiA, new Set(), new Map()), ...nodesFor(treeB, hiB, new Set(), new Map())],
        edges: [...edgesFor(treeA), ...edgesFor(treeB)],
        description,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });

    yield frame(new Set(), new Set(), `Computing ordered tree edit distance for ${n} and ${m} nodes.`, 0, {
        phase: "start",
        nodesA: n,
        nodesB: m,
    });
    step += 1;

    const rootsA = keyroots(treeA);
    const rootsB = keyroots(treeB);
    yield frame(
        new Set(rootsA),
        new Set(rootsB),
        `Keyroots: ${rootsA.join(",")} and ${rootsB.join(",")}.`,
        1,
        { phase: "keyroots", keyrootsA: rootsA.join(","), keyrootsB: rootsB.join(",") },
    );
    step += 1;

    for (const k1 of rootsA) {
        for (const k2 of rootsB) {
            dist(treeA.left[k1] ?? k1, k1, treeB.left[k2] ?? k2, k2);
        }
    }

    for (const event of cellEvents) {
        const loA = new Set<number>();
        const loB = new Set<number>();
        const la = treeA.left[event.i] ?? event.i;
        const lb = treeB.left[event.j] ?? event.j;
        for (let i = la; i <= event.i; i += 1) {
            loA.add(i);
        }
        for (let j = lb; j <= event.j; j += 1) {
            loB.add(j);
        }
        yield frame(
            loA,
            loB,
            `Compared subtrees rooted at ${treeA.ids[event.i - 1]} and ${treeB.ids[event.j - 1]}: distance ${event.value}.`,
            2,
            {
                phase: "cell",
                cellA: event.i,
                cellB: event.j,
                value: event.value,
                cells: cells.slice(-8),
            },
        );
        step += 1;
    }

    const distance = dist(treeA.left[treeA.root] ?? treeA.root, treeA.root, treeB.left[treeB.root] ?? treeB.root, treeB.root);
    const finalA = new Set<number>();
    const finalB = new Set<number>();
    for (let i = 1; i <= treeA.ids.length; i += 1) {
        finalA.add(i);
    }
    for (let j = 1; j <= treeB.ids.length; j += 1) {
        finalB.add(j);
    }
    yield frame(
        finalA,
        finalB,
        `Tree edit distance = ${distance} (relabel, insert and delete operations).`,
        3,
        { phase: "done", distance, cells: cells.slice(-8) },
    );

    return;
}

/** The Zhang-Shasha tree edit distance module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Editing a tree means changing a label, deleting a node (whose children rise into its place), or inserting a node (whose children become a contiguous block). The trick is to number nodes in postorder so every subtree occupies a contiguous block, then reuse one forest DP table for all pairs of keyroot subtrees instead of recomputing them.",
        invariants: [
            "Postorder numbering places each subtree in one contiguous index range.",
            "left[i] is the smallest index in the subtree rooted at i.",
            "A memo entry depends only on the four range endpoints, never on evaluation order.",
        ],
        correctness:
            "Consider the last roots a and b of the two forests. Any optimal script either deletes a, inserts b, or renames a to b. Deleting or inserting reduces to a smaller forest by one node. Renaming costs the label difference plus the exact edit distance of the two children forests, which postorder contiguity makes a contiguous subrange and which the same recurrence has already computed. Taking the minimum over the three cases gives the optimal distance by induction on the forest sizes.",
        complexityRationale:
            "Each memo entry is computed once and combines three earlier entries in constant time. There are O(n*m) keyroot-aligned range pairs in the classic implementation, giving O(n*m) time for those turns and O(n*m) space for the table; the visualization stores one frame per computed cell.",
        uses: [
            "Comparing hierarchical XML or JSON documents structurally",
            "Measuring similarity between parse trees in compiler optimization",
            "RNA secondary-structure and phylogenetic tree comparison",
        ],
        references: [
            "Zhang and Shasha, Simple Fast Algorithms for the Editing Distance Between Trees, SIAM Journal on Computing 18 (1989)",
            "Tai, The Tree-to-Tree Correction Problem, Journal of the ACM 26 (1979)",
            "Gusfield, Algorithms on Strings, Trees and Sequences, Chapter 14",
        ],
        workedExample:
            "Take a chain a-b-c-d and a tree a-b-c with an extra d hanging from a. Renaming costs one when labels differ; deleting the misplaced d costs one; matching the shared a-b-c chain costs zero. The DP finds total distance one or two depending on the exact labels, matching a hand check of the smallest edit script.",
    },
    id: "tree-edit-distance-zhang-shasha",
    name: "Zhang-Shasha Tree Edit Distance",
    category: "tree",
    complexity: { time: "O(n * m)", space: "O(n * m)" },
    defaultInput: {
        treeA: {
            ids: ["A", "B", "C", "D"],
            parentMap: { A: null, B: "A", C: "B", D: "C" },
            labels: { A: "a", B: "b", C: "c", D: "d" },
        },
        treeB: {
            ids: ["W", "X", "Y", "Z"],
            parentMap: { W: null, X: "W", Y: "X", Z: "W" },
            labels: { W: "a", X: "b", Y: "c", Z: "d" },
        },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "number every node in postorder across each tree",
        "for each node store left, its leftmost leaf descendant index",
        "collect keyroots: nodes whose left value appears for the first time",
        "for every keyroot pair initialize the forest DP boundary to zero",
        "fill the minimum of delete, insert and rename plus children distance",
        "the children distance is the memoized value for the two child forests",
        "done: the cell for both full roots is the tree edit distance",
    ],
};

export default module;
