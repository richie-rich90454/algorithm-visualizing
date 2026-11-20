/**
 * rich-club-coefficient.ts - Rich-Club Coefficient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The rich-club coefficient asks whether the highest-degree vertices form a
 * tightly connected club. For a degree threshold k it takes the subgraph of
 * vertices with degree greater than k and measures its edge density: twice
 * the number of internal edges divided by the number of possible node pairs.
 * The module reports the full curve for k from zero up to the maximum degree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * E) for K thresholds, or O(V^2 + E) with bitsets
 *   Space: O(V + E) for the graph and degree table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices above the current threshold turn yellow.
 *   - Edges inside the rich club turn green.
 *   - The final frame reports the density curve.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface Pair {
    edges?: Array<[string, string]>;
}

const FALLBACK_EDGES: Array<[string, string]> = [
    ["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"],
    ["D", "E"], ["D", "F"], ["E", "G"], ["F", "G"], ["G", "H"],
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Pair | null) ?? {};
    const raw = Array.isArray(task.edges) && task.edges.length > 0 ? task.edges : FALLBACK_EDGES;
    const edgesIn = raw.filter(
        (pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string" && pair[0] !== pair[1],
    );
    const labels = [...new Set(edgesIn.flatMap(([a, b]) => [a, b]))].sort();
    const adjacency: Record<string, Set<string>> = {};
    for (const label of labels) {
        adjacency[label] = new Set<string>();
    }
    for (const [a, b] of edgesIn) {
        adjacency[a]?.add(b);
        adjacency[b]?.add(a);
    }

    const simpleAdjacency: Record<string, string[]> = {};
    for (const label of labels) {
        simpleAdjacency[label] = [...(adjacency[label] ?? [])].sort();
    }
    const nodes = makeGraphNodes(labels);
    const edges = makeGraphEdges(simpleAdjacency);
    for (const edge of edges) {
        edge.directed = false;
    }
    const degrees = labels.map((label) => adjacency[label]?.size ?? 0);
    const maxDegree = Math.max(0, ...degrees);
    const uniqueEdges = edgesIn
        .map(([a, b]) => (a < b ? [a, b] : [b, a]) as [string, string])
        .filter(([a, b], index, all) => all.findIndex(([x, y]) => x === a && y === b) === index);

    const ks: number[] = [];
    const phi: number[] = [];
    const clubSizes: number[] = [];
    const clubEdges: number[] = [];
    for (let k = 0; k < maxDegree; k += 1) {
        const club = new Set(labels.filter((_, index) => (degrees[index] ?? 0) > k));
        let internal = 0;
        for (const [a, b] of uniqueEdges) {
            if (club.has(a) && club.has(b)) {
                internal += 1;
            }
        }
        const size = club.size;
        const possible = (size * (size - 1)) / 2;
        ks.push(k);
        clubSizes.push(size);
        clubEdges.push(internal);
        phi.push(possible > 0 ? internal / possible : 1);
    }
    const leader = phi.indexOf(Math.max(...phi));

    const snapshot = (
        k: number | null,
        description: string,
        codeLineNumber: number,
    ): VisualFrame => {
        for (const node of nodes) {
            node.state = "visited";
        }
        for (const edge of edges) {
            edge.state = "idle";
        }
        if (k !== null) {
            const club = new Set(labels.filter((_, index) => (degrees[index] ?? 0) > k));
            for (const label of club) {
                const node = nodes.find((item) => item.id === `node-${label}`);
                if (node) {
                    node.state = "comparing";
                }
            }
            for (const edge of edges) {
                const source = edge.sourceId.replace(/^node-/, "");
                const target = edge.targetId.replace(/^node-/, "");
                if (club.has(source) && club.has(target)) {
                    edge.state = "highlight";
                }
            }
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                labels: [...labels],
                degree: [...degrees],
                thresholds: [...ks],
                phi: [...phi],
                clubSizes,
                clubEdges,
                maxDegree,
                peakThreshold: ks[leader] ?? 0,
            },
        };
    };

    let step = 0;
    const setup = snapshot(null, "Measure how densely the highest-degree vertices connect to each other.", 0);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let index = 0; index < ks.length; index += 1) {
        const k = ks[index] ?? 0;
        const frame = snapshot(
            k,
            `Threshold k=${k}: ${clubSizes[index] ?? 0} rich vertices with ${clubEdges[index] ?? 0} internal edges, density ${(phi[index] ?? 0).toFixed(3)}.`,
            3,
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
    }

    for (const node of nodes) {
        node.state = "sorted";
    }
    const final = snapshot(null, `Peak rich-club density ${(phi[leader] ?? 0).toFixed(3)} at degree threshold ${ks[leader] ?? 0}.`, 6);
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "In many networks the most connected nodes form an elite that links disproportionately to itself. The rich-club coefficient tests this by raising the degree threshold and, at each level, measuring the density of the subgraph made of vertices above it. A value near one means the rich are tightly knit; a value near zero means they avoid each other.",
        invariants: [
            "The club at threshold k contains exactly the vertices whose degree is strictly greater than k.",
            "Internal edges are counted once, between vertices that both belong to the club.",
            "A club of fewer than two vertices is assigned density one by convention.",
        ],
        correctness:
            "The number of unordered pairs in a club of size s is s(s-1)/2, and the internal edge count is obtained by scanning every distinct edge and testing membership of both ends. Their ratio times two is the edge density of the induced subgraph, which is exactly the rich-club coefficient phi(k). Sweeping k produces the full coefficient curve.",
        complexityRationale:
            "There are at most V thresholds, and each scans the E edges once, so the sweep costs O(V * E) in this straightforward implementation; storing the adjacency and degree table uses O(V + E) space.",
        uses: [
            "Detecting elite core structure in social and collaboration networks",
            "Analyzing robustness of transportation and power grids",
            "Comparing real networks to degree-preserving null models",
        ],
        references: [
            "Zhou and Mondragon, The Rich-Club Phenomenon in the Internet Topology, 2004",
            "Colizza, Flammini, and Vespignani, Characterizing and Modeling Network Topology, 2006",
        ],
        workedExample:
            "For a clique of four vertices plus a few leaves, at k=2 the club is the four clique vertices with 6 internal edges out of 6 possible pairs, so phi(2)=1. Adding a threshold the leaves cannot reach keeps the elite club dense, revealing a strong rich club.",
    },
    id: "rich-club-coefficient",
    name: "Rich-Club Coefficient",
    category: "graph",
    complexity: { time: "O(V * E)", space: "O(V + E)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"], ["D", "F"], ["E", "G"], ["F", "G"], ["G", "H"]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute the degree of every vertex",
        "for each threshold k from zero to maximum degree minus one",
        "collect vertices whose degree is greater than k",
        "count edges whose two ends are both in that club",
        "divide twice the internal count by club size times club size minus one",
        "record the coefficient for this threshold",
        "done: report the rich-club density curve",
    ],
};

export default module;
