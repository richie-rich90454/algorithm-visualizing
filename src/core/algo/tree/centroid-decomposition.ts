/**
 * centroid-decomposition.ts – Centroid Decomposition of a Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Centroid decomposition repeatedly removes the *centroid* of the current
 * tree – a vertex whose removal splits the tree into components each with at
 * most half the vertices. Removing centroids layer by layer builds a "centroid
 * tree" of depth O(log V), which is the backbone of many advanced tree query
 * algorithms (path counting, closest red node, etc.).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V log V) to build the decomposition
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current centroid is YELLOW (comparing).
 *   - Its removal splits the tree into components (each tinted differently).
 *   - Removed centroids are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "recursive balance" property guarantees O(log V) depth.
 *   - A key technique in competitive programming for tree path queries.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Centroid Decomposition generator.
 *
 * @param input `{ parentMap, ids }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { parentMap?: Record<string, string | null>; ids?: string[] } | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(
            task.parentMap ?? {
                B: "A",
                C: "A",
                D: "B",
                E: "B",
                F: "C",
                G: "E",
                H: "G",
            },
        ),
    );
    const ids = task.ids ?? ["A", "B", "C", "D", "E", "F", "G", "H"];

    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Undirected adjacency.
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
        adjacency.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            adjacency.get(child)?.push(parent);
            adjacency.get(parent)?.push(child);
        }
    }

    let step = 0;
    const decomposition: string[] = [];
    const removed = new Set<string>();

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Centroid decomposition – removing centroids so each piece halves in size.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { removed: 0 },
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "tree",
        meta: { removed: removed.size, order: [...decomposition] },
    });

    // ------------------------------------------------------------------
    // Recursive decomposition: find the centroid, remove it, recurse on the
    // surviving components.
    // ------------------------------------------------------------------
    const decompose = function* (start: string): Generator<VisualFrame, void, unknown> {
        // Gather the current component (vertices not yet removed and reachable).
        const component: string[] = [];
        const queue: string[] = [start];
        const seen = new Set<string>([start]);

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            component.push(current);
            for (const neighbor of adjacency.get(current) ?? []) {
                if (!removed.has(neighbor) && !seen.has(neighbor)) {
                    seen.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }

        if (component.length === 0) {
            return;
        }

        // Compute subtree sizes via a DFS from `start`, ignoring removed nodes.
        const size = new Map<string, number>();
        const computeSize = (node: string, parent: string): number => {
            let total = 1;
            for (const neighbor of adjacency.get(node) ?? []) {
                if (neighbor !== parent && !removed.has(neighbor)) {
                    total += computeSize(neighbor, node);
                }
            }
            size.set(node, total);
            return total;
        };
        computeSize(start, "");

        // Find the centroid: a node whose largest child component ≤ total/2.
        const total = component.length;
        const findCentroid = (node: string, parent: string): string => {
            for (const neighbor of adjacency.get(node) ?? []) {
                if (neighbor !== parent && !removed.has(neighbor)) {
                    const childSize = size.get(neighbor) ?? 0;
                    if (childSize > total / 2) {
                        return findCentroid(neighbor, node);
                    }
                }
            }
            return node;
        };
        const centroid = findCentroid(start, "");

        // Mark and remove the centroid.
        removed.add(centroid);
        decomposition.push(centroid);

        const centroidEntity = nodeById.get(`node-${centroid}`);
        if (centroidEntity) {
            centroidEntity.state = "sorted";
        }
        yield buildFrame(`Centroid of the ${total}-node component is ${centroid} – removing it.`);
        step += 1;

        // Recurse on each component left behind by the removal.
        for (const neighbor of adjacency.get(centroid) ?? []) {
            if (!removed.has(neighbor)) {
                yield* decompose(neighbor);
            }
        }
    };

    yield* decompose(ids[0] ?? "A");

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Centroid decomposition complete – removal order: ${decomposition.join(", ")}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { removed: removed.size },
    };
}

/** The Centroid Decomposition module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "A centroid is a node whose removal splits the tree into pieces each holding at most half the vertices. Centroid decomposition repeatedly removes centroids, building a secondary tree whose depth is logarithmic because each removal at least halves the remaining component size.",
        "invariants": [
            "The chosen centroid leaves no component larger than half the current tree.",
            "Every original vertex is assigned to exactly one centroid level.",
            "Following parent links in the decomposition tree reaches smaller and smaller components."
        ],
        "correctness": "A centroid always exists in a tree, and removing it strictly shrinks every resulting component to at most half the previous size. Recursing on those components therefore terminates and assigns each vertex once. Because sizes halve at every level, the recursion depth is O(log n), and the parent links form a tree over the centroids; many global path queries can then be answered by combining contributions along these O(log n) levels.",
        "complexityRationale": "Computing a centroid scans its current component, and each vertex is scanned once per level over O(log n) levels, giving O(n log n) build time. The decomposition tree and size arrays use O(n) space.",
        "uses": [
            "Counting paths with a given property in trees",
            "Finding nearest marked or red nodes",
            "Competitive programming queries on static trees"
        ],
        "references": [
            "Competitive Programming 3, Hall and Li, advanced tree chapter",
            "Cormen et al., Introduction to Algorithms, Chapter 22"
        ],
        "workedExample": "For the path 1-2-3-4-5-6, node 3 is a centroid because removing it leaves components of sizes 2 and 3. Removing it leaves {1,2} and {4,5,6}, whose centroids are 2 and 5. The decomposition tree has depth 2."
    },

    id: "centroid-decomposition",
    name: "Centroid Decomposition",
    category: "tree",
    complexity: { time: "O(V log V)", space: "O(V)" },
    // The standard tree – the first centroid is B (or its neighbor).
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "start with the full tree as one active component",
        "compute subtree sizes inside the active component",
        "find centroid whose removal halves every piece",
        "remove centroid and recurse on each remaining piece",
        "return centroid removal order as the decomposition",
    ],
};

export default module;
