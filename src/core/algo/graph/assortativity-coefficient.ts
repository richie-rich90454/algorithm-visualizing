/**
 * assortativity-coefficient.ts - Degree Assortativity Coefficient
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Degree assortativity measures whether similar vertices connect to each
 * other. It is the Pearson correlation of the degrees at the two ends of the
 * edges: positive when high-degree vertices attach to high-degree vertices,
 * negative when they attach to low-degree ones, and near zero when degree is
 * unrelated to partnership. A value of 1 means perfectly assortative.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) to compute degrees and scan edges
 *   Space: O(V + E) for the symmetric adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The endpoints of the edge being sampled turn yellow.
 *   - The final frame reports the running correlation.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface Pair {
    edges?: Array<[string, string]>;
}

const FALLBACK_EDGES: Array<[string, string]> = [
    ["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"], ["D", "F"], ["E", "F"],
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
    const degrees = new Map(labels.map((label) => [label, adjacency[label]?.size ?? 0]));

    const uniqueEdges = edgesIn
        .map(([a, b]) => (a < b ? [a, b] : [b, a]) as [string, string])
        .filter(([a, b], index, all) => all.findIndex(([x, y]) => x === a && y === b) === index);
    // Use both orientations of every edge so the correlation is independent of
    // endpoint order and matches Newman's degree-assortativity formula.
    const directedDegrees: Array<[number, number]> = [];
    for (const [a, b] of uniqueEdges) {
        const da = degrees.get(a) ?? 0;
        const db = degrees.get(b) ?? 0;
        directedDegrees.push([da, db], [db, da]);
    }
    const xs = directedDegrees.map(([x]) => x);
    const ys = directedDegrees.map(([, y]) => y);
    const count = xs.length;
    const meanX = count > 0 ? xs.reduce((sum, value) => sum + value, 0) / count : 0;
    const meanY = count > 0 ? ys.reduce((sum, value) => sum + value, 0) / count : 0;
    let covariance = 0;
    let varianceX = 0;
    let varianceY = 0;
    for (let index = 0; index < count; index += 1) {
        const dx = (xs[index] ?? 0) - meanX;
        const dy = (ys[index] ?? 0) - meanY;
        covariance += dx * dy;
        varianceX += dx * dx;
        varianceY += dy * dy;
    }
    const denominator = Math.sqrt(varianceX * varianceY);
    const r = denominator > 1e-12 ? covariance / denominator : 0;
    const endpointDegrees = uniqueEdges.map(([a, b]) => [degrees.get(a) ?? 0, degrees.get(b) ?? 0]);

    const snapshot = (
        sample: [string, string] | null,
        index: number,
        description: string,
        codeLineNumber: number,
    ): VisualFrame => {
        for (const node of nodes) {
            node.state = "visited";
        }
        if (sample) {
            for (const label of sample) {
                const node = nodes.find((item) => item.id === `node-${label}`);
                if (node) {
                    node.state = "comparing";
                }
            }
        }
        for (const edge of edges) {
            edge.state = "idle";
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
                degree: labels.map((label) => degrees.get(label) ?? 0),
                endpointDegrees,
                edgeCount: uniqueEdges.length,
                sampled: index,
                assortativity: r,
            },
        };
    };

    let step = 0;
    const setup = snapshot(null, -1, "Correlate the degrees at the two ends of every edge.", 0);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let index = 0; index < uniqueEdges.length; index += 1) {
        const pair = uniqueEdges[index] ?? ["", ""];
        const frame = snapshot(
            pair,
            index,
            `Edge ${pair[0]}-${pair[1]} joins degrees ${degrees.get(pair[0]) ?? 0} and ${degrees.get(pair[1]) ?? 0}.`,
            2,
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
    }

    for (const node of nodes) {
        node.state = "sorted";
    }
    const verdict = r > 0.05 ? "assortative" : r < -0.05 ? "disassortative" : "uncorrelated";
    const final = snapshot(null, uniqueEdges.length, `Assortativity r = ${r.toFixed(4)} (${verdict}).`, 5);
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Do popular nodes befriend other popular nodes? Assortativity answers by correlating the degrees of the two endpoints of each edge. A positive value means like connects to like, a negative value means hubs prefer obscure partners, and zero means degree tells you nothing about who links to whom.",
        invariants: [
            "Every undirected edge contributes two ordered endpoint-degree pairs.",
            "The mean degree at the first and second positions of those pairs is identical.",
            "The coefficient always lies between minus one and one.",
        ],
        correctness:
            "Pearson correlation is computed over both orientations of each distinct edge. Averaging over the doubled data gives the mean of (j+k)/2 for each position, the second moment gives the mean of (j^2+k^2)/2, and the cross moment gives the mean of j times k, which are exactly the three terms of Newman's degree-assortativity formula. Using both orientations makes the result independent of how endpoints are labeled. The Cauchy-Schwarz inequality bounds it by one in absolute value.",
        complexityRationale:
            "Degrees are obtained by scanning the adjacency once and the correlation pass scans each distinct edge a constant number of times, giving O(V + E) time and O(V + E) space for the stored graph.",
        uses: [
            "Characterizing social networks as homophilic or heterophilic",
            "Comparing collaboration patterns across disciplines",
            "Studying robustness and epidemic spreading in contact networks",
        ],
        references: [
            "Newman, Assortative Mixing in Networks, 2002",
            "Newman, Networks: An Introduction, Chapter 7",
        ],
        workedExample:
            "A star centered at C with four leaves has four edges, each pairing degree 4 with degree 1. The endpoint degrees are perfectly anticorrelated, giving r = -1 and identifying the graph as strongly disassortative.",
    },
    id: "assortativity-coefficient",
    name: "Assortativity Coefficient",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"], ["D", "F"], ["E", "F"]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute the degree of every vertex",
        "list each undirected edge with its endpoint degrees",
        "compute the mean degree at each end of the edges",
        "sum products of deviations for covariance and variances",
        "divide covariance by the square root of the variance product",
        "done: report the degree assortativity coefficient",
    ],
};

export default module;
