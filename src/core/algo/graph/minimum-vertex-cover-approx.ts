/**
 * minimum-vertex-cover-approx.ts - Matching-Based Vertex Cover Approximation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A vertex cover is a set of vertices touching every edge. Finding the
 * smallest one is hard, but a maximal matching gives a simple guarantee: the
 * two endpoints of every matched edge must cover that edge, and taking all of
 * them covers the whole graph. Because the matching is maximal, no edge is
 * left with both ends free, so the chosen set is a valid cover at most twice
 * the optimum size.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) to deduplicate edges and scan them once
 *   Space: O(V + E) for the edge list, matching, and cover sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The scanned edge flashes YELLOW; matched edges are GREEN.
 *   - Rejected edges are RED; cover vertices are CYAN in the final frame.
 *   - meta reports the cover size and matching size side by side.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

function undirectedEdges(adjacency: Adj): Array<{ a: string; b: string; id: string }> {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const out: Array<{ a: string; b: string; id: string }> = [];
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ a, b, id: `edge-${[a, b].sort().join("-")}` });
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Adj } | null) ?? {};
    const adjacency: Adj = task.adjacency ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "E"],
        D: ["B", "E", "F"],
        E: ["C", "D", "F"],
        F: ["D", "E"],
    };
    const vertices = Object.keys(adjacency).sort();
    if (vertices.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - the empty set is already a vertex cover.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { coverSize: 0, matchingSize: 0, cover: [] },
        };
        return;
    }
    const edges = undirectedEdges(adjacency);
    const matched = new Set<string>();
    const matchedVertices = new Set<string>();
    const nodes: VisualEntity[] = makeGraphNodes(vertices);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let step = 0;

    const snap = (description: string, line: number, scanning: string, rejected: string, final: boolean): VisualFrame => {
        for (const node of nodes) {
            node.state = final && matchedVertices.has(String(node.value)) ? "path" : "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map((e) => ({
            id: e.id,
            sourceId: `node-${e.a}`,
            targetId: `node-${e.b}`,
            label: "",
            state: matched.has(e.id) ? "sorted" : e.id === scanning ? "comparing" : e.id === rejected ? "error" : "idle",
            directed: false,
        }));
        return {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: visualEdges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                coverSize: matchedVertices.size,
                matchingSize: matched.size,
                cover: [...matchedVertices].sort(),
            },
        };
    };

    yield snap(`Build a maximal matching on ${vertices.length} vertices and ${edges.length} edges.`, 0, "", "", false);
    step += 1;

    for (const edge of edges) {
        if (!matchedVertices.has(edge.a) && !matchedVertices.has(edge.b)) {
            matched.add(edge.id);
            matchedVertices.add(edge.a);
            matchedVertices.add(edge.b);
            const a = byId.get(`node-${edge.a}`);
            const b = byId.get(`node-${edge.b}`);
            if (a) a.state = "path";
            if (b) b.state = "path";
            yield snap(`Take ${edge.a}-${edge.b}; both ends are still free.`, 3, edge.id, "", false);
        } else {
            yield snap(`Skip ${edge.a}-${edge.b}; an endpoint is already matched.`, 2, edge.id, edge.id, false);
        }
        step += 1;
    }

    yield snap(
        `Cover has ${matchedVertices.size} vertices from ${matched.size} matched edges - at most twice the optimum.`,
        6,
        "",
        "",
        true,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Pick edges greedily as long as both endpoints are free. Every edge you pick forces at least one of its endpoints into any cover, so you can safely put both ends in your own cover. Greedily chosen edges cannot be left over, which is what keeps the answer within a factor of two of the best possible cover.",
        invariants: [
            "Matched edges never share an endpoint.",
            "The cover is exactly the set of matched endpoints.",
            "After the scan no edge has both endpoints outside the cover.",
        ],
        correctness:
            "The scan stops only when every unmatched edge touches a matched vertex, so the endpoints of the matching touch every edge and form a vertex cover. Any vertex cover must include at least one endpoint of each matched edge, and those edges are disjoint, so the optimum has size at least the matching size. Our cover has exactly twice the matching size, giving the factor-of-two bound.",
        complexityRationale:
            "Deduplicating adjacency takes O(V + E). The single scan checks each edge with constant-time set lookups, so total time is O(V + E); the edge list and two sets use O(V + E) space.",
        uses: [
            "Selecting a small set of sensors to monitor every communication link",
            "Choosing test points that touch all critical paths in a circuit",
            "A fast preprocessing step in exact vertex-cover solvers",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, approximation algorithms chapter",
            "Garey and Johnson, Computers and Intractability, the vertex cover problem",
        ],
        workedExample:
            "On a path A-B-C-D the scan takes A-B, skips B-C, then takes C-D. The cover is A, B, C, D of size four, while the optimum is two, showing the factor-of-two bound is tight for this greedy rule.",
    },
    id: "minimum-vertex-cover-approx",
    name: "Minimum Vertex Cover Approximation",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "E"],
            D: ["B", "E", "F"],
            E: ["C", "D", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "deduplicate the undirected edge list",
        "start with an empty matching and an empty cover",
        "for each edge in scan order",
        "if both endpoints are unmatched, add the edge to the matching",
        "add both endpoints of every matched edge to the cover",
        "otherwise leave the cover unchanged",
        "after the scan the matching is maximal",
        "report the cover and its approximation size",
    ],
};

export default module;
