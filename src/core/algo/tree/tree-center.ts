/**
 * tree-center.ts – Tree Center (peeling leaves)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The center (centroid-like) of a tree is the vertex (or pair of vertices)
 * that minimizes the maximum distance to any other vertex. The classic way to
 * find it is "peeling": repeatedly remove all current leaves (vertices of
 * degree 1) along with their edges. The last one or two vertices remaining are
 * the centers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V) – each vertex is removed once
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current leaves being peeled are YELLOW (comparing).
 *   - Already-removed vertices are GRAY (unvisited).
 *   - The surviving center(s) are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The center is the "middle" of the tree in the distance sense.
 *   - A tree has either one center or two adjacent centers.
 *   - Peeling is also the basis of the k-core decomposition of graphs.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Tree Center generator.
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

    // Undirected degree map for the peeling process.
    const degree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
        degree.set(id, 0);
        adjacency.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            degree.set(child, (degree.get(child) ?? 0) + 1);
            degree.set(parent, (degree.get(parent) ?? 0) + 1);
            adjacency.get(child)?.push(parent);
            adjacency.get(parent)?.push(child);
        }
    }

    let step = 0;

    if (ids.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty tree – no center exists.",
            codeLineNumber: 0,
            layout: "tree",
            meta: { centers: 0 },
        };
        return;
    }

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Tree center – peeling leaves until one or two vertices remain.",
        codeLineNumber: 0,
        layout: "tree",
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "tree",
        meta: { step, remaining: remaining.size },
    });

    // Peel the leaves layer by layer.
    let remaining = new Set<string>(ids);
    let removed = new Set<string>();

    while (remaining.size > 2) {
        // Find the current leaves (degree ≤ 1 within the remaining set).
        const leaves: string[] = [];
        for (const id of remaining) {
            let d = 0;
            for (const neighbor of adjacency.get(id) ?? []) {
                if (remaining.has(neighbor)) {
                    d += 1;
                }
            }
            if (d <= 1) {
                leaves.push(id);
            }
        }

        // Highlight and remove them.
        for (const leaf of leaves) {
            const node = nodeById.get(`node-${leaf}`);
            if (node) {
                node.state = "comparing";
            }
            remaining.delete(leaf);
            removed.add(leaf);
        }
        yield buildFrame(`Peeling leaves: [${leaves.join(", ")}] – ${remaining.size} remain.`);
        step += 1;

        // Mark peeled leaves as gone.
        for (const leaf of removed) {
            const node = nodeById.get(`node-${leaf}`);
            if (node) {
                node.state = "unvisited";
            }
        }
        yield buildFrame(
            `Peeled leaves [${leaves.join(", ")}] cleared – ${remaining.size} nodes remain.`,
        );
        step += 1;
    }

    // The remaining one or two vertices are the center(s).
    const centers = [...remaining];
    for (const center of centers) {
        const node = nodeById.get(`node-${center}`);
        if (node) {
            node.state = "sorted";
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            centers.length === 1
                ? `The tree center is ${centers[0]}.`
                : `The tree has two adjacent centers: ${centers[0]} and ${centers[1]}.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { centers, centerCount: centers.length },
    };
}

/** The Tree Center module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "The center of a tree is the vertex or pair of vertices that minimizes the farthest distance to any other node. Leaf peeling finds it by repeatedly removing all current leaves at once; the last one or two vertices left are the centers.",
        "invariants": [
            "Peeling a layer of leaves does not change the set of centers.",
            "The eccentricity of remaining vertices decreases by one each round.",
            "A tree ends with either one center or two adjacent centers."
        ],
        "correctness": "Removing every leaf shortens all longest paths by exactly one at each end, so the vertices minimizing maximum distance remain the same after a round. Repeating until one or two vertices remain gives the middle of every longest path, which is the center. A tree has one center if its diameter is even and two adjacent centers if the diameter is odd, which matches the final peeling result.",
        "complexityRationale": "Each vertex is removed at most once and edges are examined when their endpoints are peeled, giving O(n) time. The degree counts and queue use O(n) space.",
        "uses": [
            "Finding optimal meeting points in a tree network",
            "Computing tree radius from the center",
            "Rooting a tree to minimize height"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 22 (tree properties)",
            "Harary, Graph Theory, Chapter 4"
        ],
        "workedExample": "For the path 1-2-3-4-5-6, peel leaves 1 and 6, then 2 and 5, then 3 and 4. Two adjacent vertices remain, so the tree has centers 3 and 4."
    },

    id: "tree-center",
    name: "Tree Center",
    category: "tree",
    complexity: { time: "O(V)", space: "O(V)" },
    // Same tree as Tree Diameter – its center is B (or the pair around it).
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "compute degree of every node in the tree",
        "collect current leaves with degree at most one",
        "peel all current leaves in one layer",
        "repeat peeling until one or two nodes remain",
        "return remaining center nodes as the answer",
    ],
};

export default module;
