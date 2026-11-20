/**
 * greedy-matching.ts - Greedy Maximal Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A matching is a set of edges with no shared endpoints. This greedy method
 * scans the edge list once, taking an edge whenever both of its endpoints are
 * still free. When the scan ends, every remaining edge touches a matched
 * vertex, so the matching is maximal: no edge can be added without undoing a
 * previous choice. It is a fast approximation to a maximum matching.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) to build the edge list and scan it once
 *   Space: O(V + E) for adjacency, the edge list, and the matched set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are undirected connections.
 *   - The scanned edge is highlighted; chosen edges are green.
 *   - Rejected edges are red and the matching size is in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]> } | null) ?? {};
    const adjacencyInput = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "D", "E"],
        D: ["B", "C", "F"],
        E: ["C", "F"],
        F: ["D", "E"],
    };
    const vertices = Object.keys(adjacencyInput).sort();
    const edges: Array<{ a: string; b: string; id: string }> = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const raw of adjacencyInput[a] ?? []) {
            const b = String(raw);
            if (!vertices.includes(b) || a === b) {
                continue;
            }
            const id = [a, b].sort().join("-");
            if (seen.has(id)) {
                continue;
            }
            seen.add(id);
            edges.push({ a, b, id: `edge-${id}` });
        }
    }
    const matchedEdges = new Set<string>();
    const matchedVertices = new Set<string>();
    const nodes: VisualEntity[] = makeGraphNodes(vertices);

    const snap = (
        message: string,
        line: number,
        scanning: string,
        rejected: string,
    ): VisualFrame => {
        for (const node of nodes) {
            node.state = matchedVertices.has(String(node.value)) ? "sorted" : "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map((edge) => ({
            id: edge.id,
            sourceId: `node-${edge.a}`,
            targetId: `node-${edge.b}`,
            label: "",
            state:
                matchedEdges.has(edge.id)
                    ? "sorted"
                    : edge.id === scanning
                      ? "comparing"
                      : edge.id === rejected
                        ? "error"
                        : "idle",
            directed: false,
        }));
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                edgeCount: edges.length,
                matchingSize: matchedEdges.size,
                matchedVertices: [...matchedVertices].sort(),
                matching: [...matchedEdges].sort(),
            },
        };
    };

    yield {
        ...snap("Scanning edges once to build a maximal matching.", 1, "", ""),
        stepNumber: 0,
    };
    let step = 1;

    for (const edge of edges) {
        if (!matchedVertices.has(edge.a) && !matchedVertices.has(edge.b)) {
            matchedEdges.add(edge.id);
            matchedVertices.add(edge.a);
            matchedVertices.add(edge.b);
            yield {
                ...snap(`Take ${edge.a}-${edge.b}: both endpoints are free (${matchedEdges.size} chosen).`, 3, edge.id, ""),
                stepNumber: step,
            };
        } else {
            yield {
                ...snap(`Skip ${edge.a}-${edge.b}: at least one endpoint is already matched.`, 2, edge.id, edge.id),
                stepNumber: step,
            };
        }
        step += 1;
    }

    yield {
        ...snap(
            `Maximal matching of size ${matchedEdges.size}; no edge joins two free vertices.`,
            6,
            "",
            "",
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Take edges whenever both ends are still available, then stop. Once every edge touches a chosen vertex, no further edge can be added without removing one already taken. That makes the result maximal, even though a different order of choices might have produced more edges.",
        invariants: [
            "No two chosen edges share an endpoint.",
            "A skipped edge touches at least one vertex already matched.",
            "The matching size never decreases during the scan.",
        ],
        correctness:
            "Adding an edge only when both endpoints are free keeps the matching valid. At the end, any unchosen edge had a matched endpoint when it was scanned and vertices never become free again, so every edge touches the matching; the matching is therefore maximal. Valid maximality follows directly from the scan rule.",
        complexityRationale:
            "Deduplicating adjacency costs O(V + E), and the single scan tests each edge once with constant-time set lookups, so total time is O(V + E). The edge list, sets, and entities use O(V + E) space.",
        uses: [
            "Quick pairing of requests in load balancers",
            "Initial matching heuristics before a more expensive augmenting algorithm",
            "Scheduling disjoint pairs under tight time budgets",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on matchings",
            "Lovasz and Plummer, Matching Theory",
        ],
        workedExample:
            "For a path A-B-C-D the scan takes A-B, skips B-C because B is matched, then takes C-D, producing two edges. For the order B-C first, the scan takes only B-C because A and D are then blocked by B and C, showing why greedy is not always maximum.",
    },
    id: "greedy-matching",
    name: "Greedy Maximal Matching",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["A", "D"],
            C: ["A", "D", "E"],
            D: ["B", "C", "F"],
            E: ["C", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "deduplicate the undirected edge list",
        "initialize empty matched-edge and matched-vertex sets",
        "for each edge in scan order",
        "if both endpoints are free, add the edge to the matching",
        "otherwise skip the edge and keep scanning",
        "after the scan, verify no edge joins two free vertices",
        "report the maximal matching and its size",
    ],
};

export default module;
