/**
 * minimum-degree-ordering.ts - Minimum Degree Ordering for Sparse Elimination
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sparse Gaussian elimination (and Cholesky factorization) creates fill-in:
 * when a pivot v is eliminated, every pair of its remaining neighbors becomes
 * adjacent in the filled graph. The minimum-degree heuristic eliminates a
 * vertex of least current degree at every step, which tends to keep fill small.
 * This is different from degeneracy peeling, which removes a low-degree vertex
 * without connecting its neighbors.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) with a simple scan; bucket queues reduce this in practice
 *   Space: O(V + F) for the filled graph and the F fill edges
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Remaining vertices are WHITE; the chosen pivot is YELLOW; eliminated
 *     vertices are GREEN.
 *   - Edges newly created by fill-in stay ORANGE in later frames.
 *   - meta reports the elimination order and the running fill count.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const raw: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D", "E"],
        D: ["A", "B", "C", "E"],
        E: ["C", "D"],
    };

    const labels = [
        ...new Set([...Object.keys(raw), ...Object.values(raw).flat().map((v) => String(v))]),
    ].sort();
    const adj = new Map<string, Set<string>>(labels.map((v) => [v, new Set<string>()]));
    for (const a of labels) {
        for (const rawNeighbor of raw[a] ?? []) {
            const b = String(rawNeighbor);
            const setA = adj.get(a);
            const setB = adj.get(b);
            if (!setA || !setB || a === b) {
                continue;
            }
            setA.add(b);
            setB.add(a);
        }
    }

    const remaining = new Set(labels);
    const fillKeys = new Set<string>();
    const order: string[] = [];
    const frames: VisualFrame[] = [];

    const edgeKey = (a: string, b: string): string => [a, b].sort().join("|");

    const push = (
        description: string,
        codeLineNumber: number,
        pivot: string | null,
        degree: number,
    ): void => {
        const nodes: VisualEntity[] = makeGraphNodes(labels);
        for (const node of nodes) {
            const v = String(node.value);
            if (!remaining.has(v)) {
                node.state = "sorted";
            } else if (v === pivot) {
                node.state = "active";
            } else {
                node.state = "unvisited";
            }
        }
        const edges: VisualEdge[] = [];
        const seen = new Set<string>();
        for (const a of labels) {
            for (const b of adj.get(a) ?? []) {
                if (!remaining.has(a) || !remaining.has(b)) {
                    continue;
                }
                const key = edgeKey(a, b);
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                edges.push({
                    id: `edge-${key.replace("|", "-")}`,
                    sourceId: `node-${a}`,
                    targetId: `node-${b}`,
                    label: "",
                    state: fillKeys.has(key) ? "swapped" : "idle",
                    directed: false,
                });
            }
        }
        frames.push({
            stepNumber: frames.length,
            entities: nodes,
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                order: [...order],
                fillCount: fillKeys.size,
                pivot: pivot ?? "",
                degree,
            },
        });
    };

    if (labels.length === 0) {
        push("Empty graph - no ordering to compute.", 0, null, 0);
        for (const frame of frames) {
            yield frame;
        }
        return;
    }

    push("Minimum-degree ordering: fill connects each pivot's remaining neighbors.", 0, null, 0);

    while (remaining.size > 0) {
        let chosen = "";
        let bestDegree = Infinity;
        for (const v of [...remaining].sort()) {
            let degree = 0;
            for (const neighbor of adj.get(v) ?? []) {
                if (remaining.has(neighbor)) {
                    degree += 1;
                }
            }
            if (degree < bestDegree) {
                bestDegree = degree;
                chosen = v;
            }
        }
        if (chosen === "") {
            break;
        }
        const neighbors = [...(adj.get(chosen) ?? [])]
            .filter((v) => remaining.has(v))
            .sort();
        for (let i = 0; i < neighbors.length; i += 1) {
            for (let j = i + 1; j < neighbors.length; j += 1) {
                const a = neighbors[i] as string;
                const b = neighbors[j] as string;
                if (a === b || (adj.get(a) ?? new Set()).has(b)) {
                    continue;
                }
                adj.get(a)?.add(b);
                adj.get(b)?.add(a);
                fillKeys.add(edgeKey(a, b));
            }
        }
        order.push(chosen);
        remaining.delete(chosen);
        push(
            `Eliminate ${chosen} (degree ${bestDegree}); created ${fillKeys.size} fill edge(s) so far.`,
            3,
            chosen,
            bestDegree,
        );
    }

    push(
        `Order ${order.join(" -> ")} uses ${fillKeys.size} fill edge(s).`,
        7,
        null,
        0,
    );

    for (const frame of frames) {
        yield frame;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Eliminating a pivot in sparse Gaussian elimination makes all of its remaining neighbors adjacent, adding fill-in that costs time and memory. Choosing a pivot with the fewest current neighbors tends to add the least fill. The heuristic tracks the degree in the still-filled graph, so it reacts to the new edges it creates.",
        invariants: [
            "The filled graph stays symmetric and undirected after every elimination.",
            "A vertex removed from the remaining set is never chosen again.",
            "The fill count equals the number of non-original edges currently in the filled graph.",
        ],
        correctness:
            "The procedure is a deterministic heuristic, so there is no optimality claim: it always produces a valid permutation because it removes one unremoved vertex per step and stops when none remain. The simulated adjacency after each step is exactly the graph that sparse elimination would carry forward, because every pair of the pivot's remaining neighbors is connected before the pivot is dropped, which is the defining fill rule of Cholesky factorization.",
        complexityRationale:
            "Each of the V steps scans every remaining vertex and its neighbors to find a minimum, costing O(V^2 + V E) in the worst case, bounded by O(V^3). The filled adjacency and the recorded fill edges need O(V + F) space, where F is the number of fill edges.",
        uses: [
            "Ordering equations before sparse Cholesky factorization",
            "Reducing fill in finite-element and circuit simulators",
            "Choosing pivots in sparse direct solvers",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on matrix operations",
            "George and Liu, Computer Solution of Large Sparse Positive Definite Systems, 1981",
        ],
        workedExample:
            "Take a path B-C-A with extra edge A-D. Degrees are B 1, C 2, A 2, D 1, so the tie breaks on B and then D. Eliminating C connects B to A only if they were not already adjacent; the recorded order B, D, C, A shows how the heuristic defers the higher-degree center until its neighbors have been removed.",
    },
    id: "minimum-degree-ordering",
    name: "Minimum Degree Ordering",
    category: "graph",
    complexity: { time: "O(V^3)", space: "O(V + F)" },
    defaultInput: {
        graph: {
            A: ["B", "C", "D"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D", "E"],
            D: ["A", "B", "C", "E"],
            E: ["C", "D"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the symmetric filled adjacency from the input graph",
        "mark every vertex as remaining and start an empty order",
        "while a remaining vertex exists",
        "pick a remaining vertex of least degree in the filled graph",
        "make all of its remaining neighbors pairwise adjacent, recording new fill edges",
        "append the pivot to the order and remove it from the remaining set",
        "repeat until no remaining vertex is left",
        "report the order and the total fill count",
    ],
};

export default module;
