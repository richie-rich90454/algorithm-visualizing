/**
 * tree-centroid.ts - Tree Centroid
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A centroid of a tree is a vertex whose removal leaves every resulting
 * connected component with at most half of the original vertices. It is the
 * balanced separator that centroid decomposition peels away layer by layer,
 * and it can differ from the tree center, which minimizes distance instead of
 * component size. A tree has one centroid, or two adjacent centroids when an
 * edge splits it into equal halves.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2) in this visual version (one traversal per candidate vertex)
 *   Space: O(V) for the adjacency lists and the working queues
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tree is drawn with the shared tree layout and parent metadata.
 *   - Each candidate vertex is YELLOW while its component sizes are measured.
 *   - Edge labels show the size of the component on that side of the cut.
 *   - The final centroid(s) turn GREEN; every other vertex stays neutral.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Input = { parentMap?: Record<string, string | null>; ids?: string[] };

/** Count vertices reachable from start without passing through banned. */
function componentSizeAvoiding(adjacency: Map<string, string[]>, start: string, banned: string): number {
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (neighbor !== banned && !seen.has(neighbor)) {
                seen.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return seen.size;
}

/** Largest component left after removing v; zero for a lone vertex. */
function largestComponent(adjacency: Map<string, string[]>, v: string): number {
    let worst = 0;
    for (const neighbor of adjacency.get(v) ?? []) {
        worst = Math.max(worst, componentSizeAvoiding(adjacency, neighbor, v));
    }
    return worst;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(task.parentMap ?? { B: "A", C: "A", D: "B", E: "B", F: "C" }),
    );
    const ids: string[] = [];
    const fromTask = Array.isArray(task.ids) ? task.ids : [];
    const source = fromTask.length > 0 ? fromTask : [...parentMap.keys()];
    for (const id of source) {
        if (typeof id === "string" && !ids.includes(id)) {
            ids.push(id);
        }
    }

    if (ids.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty tree - there is no centroid to find.",
            codeLineNumber: 0,
            layout: "tree",
            meta: { vertices: 0, limit: 0 },
        };
        return;
    }

    const idSet = new Set(ids);
    const adjacency = new Map<string, string[]>();
    for (const id of ids) {
        adjacency.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent && idSet.has(child) && idSet.has(parent)) {
            adjacency.get(child)?.push(parent);
            adjacency.get(parent)?.push(child);
        }
    }

    const baseNodes = makeTreeNodes(parentMap, ids);
    const baseEdges = makeTreeEdges(parentMap, ids);
    const limit = ids.length / 2;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: baseNodes.map((n) => ({ ...n, metadata: { ...n.metadata } })),
        edges: baseEdges.map((e) => ({ ...e })),
        description: `Find the centroid of a ${ids.length}-node tree: no component after removal may exceed ${limit} vertices.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { vertices: ids.length, limit },
    };

    const sizes = new Map<string, number>();
    for (const v of ids) {
        const worst = largestComponent(adjacency, v);
        sizes.set(v, worst);

        const entities = baseNodes.map((n) => {
            const copy: VisualEntity = { ...n, metadata: { ...n.metadata } };
            if (n.id === `node-${v}`) {
                copy.state = "comparing";
            }
            return copy;
        });

        const edges: VisualEdge[] = baseEdges.map((e) => {
            const copy: VisualEdge = { ...e };
            const source = e.sourceId.replace(/^node-/, "");
            const target = e.targetId.replace(/^node-/, "");
            if (source === v) {
                copy.label = String(componentSizeAvoiding(adjacency, target, v));
                copy.state = "active";
            } else if (target === v) {
                copy.label = String(componentSizeAvoiding(adjacency, source, v));
                copy.state = "active";
            }
            return copy;
        });

        const neighbors = adjacency.get(v) ?? [];
        const parts = neighbors.length === 0
            ? "no neighbors, so removing it leaves no component"
            : neighbors.map((u) => `${u}:${componentSizeAvoiding(adjacency, u, v)}`).join(", ");

        yield {
            stepNumber: step++,
            entities,
            edges,
            description: `Remove ${v}: component sizes ${parts}; largest ${worst}, limit ${limit}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { vertex: v, maxComponent: worst, limit, vertices: ids.length },
        };
    }

    const centroids = ids.filter((v) => (sizes.get(v) ?? 0) <= limit);
    const finalNodes = baseNodes.map((n) => {
        const copy: VisualEntity = { ...n, metadata: { ...n.metadata } };
        const bare = n.id.replace(/^node-/, "");
        copy.state = centroids.includes(bare) ? "sorted" : "unvisited";
        return copy;
    });

    yield {
        stepNumber: step++,
        entities: finalNodes,
        edges: baseEdges.map((e) => ({ ...e, state: "sorted" as EntityState })),
        description:
            centroids.length === 1
                ? `Centroid: ${centroids[0]}; every remaining component has at most ${limit} vertices.`
                : `Centroids: ${centroids.join(" and ")}; the edge between them splits the tree into equal halves.`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { centroids, vertices: ids.length, limit },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The centroid is the vertex that best balances a tree by size: take it away and no leftover piece holds more than half the vertices. Walk through each vertex, measure the pieces hanging off each of its edges, and keep the ones whose largest piece fits under the halfway mark. A path has one middle, but a tree with an exactly balanced edge can have two adjacent middles.",
        invariants: [
            "Removing a vertex breaks the tree into one component per neighbor.",
            "The largest component after removal is at least half the tree size for every non-centroid vertex.",
            "At most two vertices can satisfy the at-most-half condition, and if two do they are adjacent.",
        ],
        correctness:
            "Deleting a vertex v produces exactly one component per incident edge, and those component sizes sum to n minus one. If any component exceeds n/2 then v cannot balance the tree, while if none does v is a centroid by definition. Two vertices w and x with largest components at most n/2 cannot be far apart: if x lies in a component of size at most n/2 after removing w, only the neighbor of w on that side can also qualify, so there are at most two and they are adjacent.",
        complexityRationale:
            "For each of the V vertices the visualization walks every incident branch, and each walk touches up to V vertices, giving O(V^2) time in this teaching version. Adjacency lists and the small queues use O(V) space; a subtree-size preprocessing trick could reduce the time to O(V).",
        uses: [
            "Picking a balanced root for divide-and-conquer on trees",
            "Centroid decomposition preprocessing for path queries",
            "Finding a fair separator when splitting a hierarchy",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 22",
            "Competitive Programming 3, Hall and Li, centroid decomposition section",
        ],
        workedExample:
            "For the path A-B-C-D-E, removing C leaves components of sizes 2 and 2, so C is the centroid. Removing B leaves sizes 1 and 3, which exceeds 5/2, so B is not. For the path A-B-C-D the edge B-C splits the tree into two halves of size 2, so both B and C qualify as centroids.",
    },
    id: "tree-centroid",
    name: "Tree Centroid",
    category: "tree",
    complexity: { time: "O(V^2)", space: "O(V)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C" },
        ids: ["A", "B", "C", "D", "E", "F"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "build undirected adjacency from the parent pointers",
        "set the size limit to half the number of vertices",
        "for each candidate vertex do the following",
        "measure each component left after removing the candidate",
        "record the largest component and compare it with the limit",
        "collect every vertex whose largest component fits the limit",
        "done: report the one or two centroids",
    ],
};

export default module;
