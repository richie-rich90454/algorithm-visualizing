/**
 * rerooting-dp.ts – Rerooting Dynamic Programming (tree DP)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rerooting DP computes a tree DP value for *every* possible root in O(V)
 * total. It first does a "down" pass (children → parent) to compute each
 * subtree's contribution, then an "up" pass (parent → children) that combines
 * the parent's other-subtree contributions with each child's own, so every
 * node eventually knows its value *as if it were the root*.
 *
 * The example problem: compute, for each vertex, the total distance from that
 * vertex to every other vertex.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V) – two DFS passes
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The down pass visits children first (comparing).
 *   - The up pass propagates parent values downward (active).
 *   - The final per-root answer is shown on each node.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The two-pass structure is the universal rerooting template.
 *   - Generalizes to any "combine subtree answers" DP that is a commutative
 *     monoid.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

/**
 * The Rerooting DP generator.
 *
 * @param input `{ parentMap, ids }` – an unweighted tree.
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

    const children = new Map<string, string[]>();
    for (const id of ids) {
        children.set(id, []);
    }
    for (const [child, parent] of parentMap) {
        if (parent) {
            children.get(parent)?.push(child);
        }
    }
    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";

    let step = 0;

    // Frame 0: the untouched tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Rerooting DP – computing the sum of distances from every possible root.",
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
        meta: { step, nodes: ids.length, root },
    });

    // ------------------------------------------------------------------
    // Down pass: subtree size and sum-of-distances *within* each subtree.
    // ------------------------------------------------------------------
    const subSize = new Map<string, number>();
    const subDist = new Map<string, number>();

    const down = function* (node: string): Generator<VisualFrame, [number, number], unknown> {
        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "comparing";
        }
        yield buildFrame(`Down pass: computing subtree stats of ${node}.`);
        step += 1;

        let size = 1;
        let dist = 0;
        for (const child of children.get(node) ?? []) {
            const [childSize, childDist] = yield* down(child);
            // Each descendant in the child's subtree is one edge farther away.
            dist += childDist + childSize;
            size += childSize;
        }
        subSize.set(node, size);
        subDist.set(node, dist);

        if (nodeEntity) {
            nodeEntity.state = "visited";
        }
        return [size, dist];
    };
    yield* down(root);

    // ------------------------------------------------------------------
    // Up pass: propagate the "outside" answer to each child, then to the root
    // answer of every node. answer[v] = subDist[v] + outside[v].
    // ------------------------------------------------------------------
    const outside = new Map<string, number>();
    const answer = new Map<string, number>();
    outside.set(root, 0);
    answer.set(root, subDist.get(root) ?? 0);

    const up = function* (node: string): Generator<VisualFrame, void, unknown> {
        const nodeEntity = nodeById.get(`node-${node}`);
        if (nodeEntity) {
            nodeEntity.state = "active";
            nodeEntity.label = String(answer.get(node) ?? 0);
        }
        yield buildFrame(`Up pass: ${node} has total distance ${answer.get(node)}.`);
        step += 1;

        // The total size of the "outside" of the whole tree relative to node.
        const nodeOutside = outside.get(node) ?? 0;

        for (const child of children.get(node) ?? []) {
            const childSize = subSize.get(child) ?? 0;
            // outside[child] = (total distance in node's other subtrees) +
            //                  (node's own outside) + (# other nodes) * 1 edge.
            const otherNodes = ids.length - childSize;
            const childOutside =
                (subDist.get(node) ?? 0) -
                ((subDist.get(child) ?? 0) + childSize) +
                nodeOutside +
                otherNodes;
            outside.set(child, childOutside);
            answer.set(child, (subDist.get(child) ?? 0) + childOutside);

            const edge = edges.find(
                (e) => e.sourceId === `node-${node}` && e.targetId === `node-${child}`,
            );
            if (edge) {
                for (const e of edges) {
                    e.state = "idle";
                }
                edge.state = "active";
            }
            yield* up(child);
        }
    };
    yield* up(root);

    for (const node of nodes) {
        node.state = "sorted";
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Rerooting complete – each node shows the sum of distances to all others.",
        codeLineNumber: 4,
        layout: "tree",
        meta: {
            sums: ids.map((id) => `${id}:${answer.get(id) ?? 0}`),
            count: ids.length,
        },
    };
}

/** The Rerooting DP module, registered with the engine. */
const module: AlgorithmModule = {
    education: {
        "intuition": "Rerooting DP computes a tree DP value for every possible root using only two passes. A down pass computes subtree contributions with the original root, and an up pass combines each parent's value from all other subtrees with the child's own value, so every node learns its answer as if it were the root.",
        "invariants": [
            "After the down pass, each node knows the DP value of its subtree rooted at that node.",
            "During the up pass, a child receives the parent's value excluding the child's contribution.",
            "The combined value at a node equals the value obtained by rerooting at that node from scratch."
        ],
        "correctness": "The down pass is ordinary tree DP and is correct by induction on subtree size. For the up pass, the value seen by a child is the parent's rerooted value minus or excluding exactly the child's subtree contribution, which is the contribution of all nodes outside that child's subtree. Combining that with the child's own subtree gives the same result a fresh rooting at the child would produce, so by induction over the up traversal every node gets the true rerooted value.",
        "complexityRationale": "Each edge is used once in the down pass and once in the up pass, with constant or monoid-combine work, so time is O(n) and the stored DP values use O(n) space.",
        "uses": [
            "Computing total distance from every node to all others",
            "Finding each node's best rerooted DP score",
            "Tree problems where the answer depends on the chosen root"
        ],
        "references": [
            "Competitive Programming 3, Hall and Li, tree chapter",
            "CLRS, Introduction to Algorithms, Chapter 15 (dynamic programming)"
        ],
        "workedExample": "On a path A-B-C with unit edges, the down pass from A gives subtree sizes 3, 2, 1. The up pass propagates outside contributions so the total distances become A = 3, B = 2, and C = 3, matching a direct computation from each root."
    },

    id: "rerooting-dp",
    name: "Rerooting DP",
    category: "tree",
    complexity: { time: "O(V)", space: "O(V)" },
    // The standard tree for a clean two-pass demonstration.
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "E", H: "G" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "root the tree arbitrarily at the first node",
        "post-order: combine child DP states into subtree sums",
        "reroot: pass parent contribution down to each child",
        "compute every node total as if it were the root",
        "return per-node distance sums as the answer",
    ],
};

export default module;
