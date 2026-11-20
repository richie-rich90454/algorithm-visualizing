/**
 * resource-allocation-index.ts - Resource Allocation Index
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The resource-allocation index models how much resource node u would send to
 * node v through their shared neighbors. Each common neighbor w contributes
 * 1 / degree(w), as if it split one unit of resource evenly among all its
 * contacts. It is a close relative of Adamic-Adar but uses the raw degree
 * instead of its logarithm.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(P * min(deg(u), deg(v))) for P candidate pairs
 *   Space: O(V + E) for degrees and the symmetric adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The scored pair turns yellow; low-degree shared neighbors turn green.
 *   - The final frame ranks all candidate pairs by resource score.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

interface Pair {
    edges?: Array<[string, string]>;
    pairs?: Array<[string, string]>;
}

const FALLBACK_EDGES: Array<[string, string]> = [
    ["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"],
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Pair | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0 ? task.edges : FALLBACK_EDGES;
    const edgesIn = rawEdges.filter(
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

    const pairsIn = Array.isArray(task.pairs) ? task.pairs : [];
    const supplied = pairsIn.filter(
        (pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string"
            && pair[0] !== pair[1] && adjacency[pair[0]] && adjacency[pair[1]] && !adjacency[pair[0]]?.has(pair[1]),
    ).map(([a, b]) => [a, b] as [string, string]);
    const candidates: Array<[string, string]> = supplied.length > 0 ? supplied : (() => {
        const result: Array<[string, string]> = [];
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) {
                const a = labels[i] ?? "";
                const b = labels[j] ?? "";
                if (!adjacency[a]?.has(b)) {
                    result.push([a, b]);
                }
            }
        }
        return result;
    })();

    const scorePair = (a: string, b: string): { score: number; shared: string[] } => {
        const setA = adjacency[a] ?? new Set<string>();
        const setB = adjacency[b] ?? new Set<string>();
        const shared = [...setA].filter((vertex) => setB.has(vertex)).sort();
        let score = 0;
        for (const vertex of shared) {
            const degree = adjacency[vertex]?.size ?? 1;
            if (degree > 0) {
                score += 1 / degree;
            }
        }
        return { score, shared };
    };
    const results = candidates.map(([a, b]) => scorePair(a, b));
    const scores = results.map((result) => result.score);
    const pairLabels = candidates.map(([a, b]) => `${a}-${b}`);
    const leader = scores.indexOf(Math.max(...scores));

    const snapshot = (
        index: number | null,
        description: string,
        codeLineNumber: number,
        ranking: string[],
    ): VisualFrame => {
        for (const node of nodes) {
            node.state = "visited";
        }
        if (index !== null) {
            const pair = candidates[index] ?? ["", ""];
            for (const label of pair) {
                const node = nodes.find((item) => item.id === `node-${label}`);
                if (node) {
                    node.state = "comparing";
                }
            }
            for (const label of results[index]?.shared ?? []) {
                const node = nodes.find((item) => item.id === `node-${label}`);
                if (node) {
                    node.state = "highlight";
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
                pairs: pairLabels,
                scores: [...scores],
                topPair: pairLabels[leader] ?? "",
                topScore: scores[leader] ?? 0,
                ranking,
            },
        };
    };

    let step = 0;
    const setup = snapshot(null, "Model resource flowing between each pair through shared neighbors.", 0, []);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let index = 0; index < candidates.length; index += 1) {
        const result = results[index];
        const frame = snapshot(
            index,
            `Pair ${pairLabels[index]}: resource score ${(result?.score ?? 0).toFixed(4)} from ${result?.shared.length ?? 0} shared neighbor(s).`,
            3,
            [],
        );
        frame.stepNumber = step;
        yield frame;
        step += 1;
    }

    const ranking = candidates
        .map((pair, index) => ({ pair: pairLabels[index] ?? "", score: scores[index] ?? 0 }))
        .sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair))
        .map((entry) => `${entry.pair}:${entry.score.toFixed(4)}`);
    for (const node of nodes) {
        node.state = "sorted";
    }
    const final = snapshot(null, `Best candidate ${pairLabels[leader] ?? ""} scores ${(scores[leader] ?? 0).toFixed(4)}.`, 5, ranking);
    final.stepNumber = step;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine each vertex holds one unit of a resource it can pass to its contacts, splitting the unit equally among them. The amount u receives from v through their common neighbors is the resource-allocation score. Low-degree common neighbors pass a larger share, so they are more valuable evidence of a missing link.",
        invariants: [
            "Only non-adjacent pairs of distinct vertices are scored.",
            "Each shared neighbor w contributes exactly 1 / degree(w).",
            "All scores are nonnegative and at most the number of shared neighbors.",
        ],
        correctness:
            "A shared neighbor w splits its single unit across degree(w) contacts, so the fraction that reaches both endpoints is 1 / degree(w). Adding these fractions over the exact intersection of the two neighbor sets gives the total resource transferred, which is the resource-allocation index.",
        complexityRationale:
            "Degrees are computed once while building adjacency, and each candidate pair scans the smaller neighbor set for membership in the other, costing O(min(deg(u), deg(v))). Space is O(V + E) for the graph and degree table.",
        uses: [
            "Recommending links in bipartite and social networks",
            "Modeling information or resource flow between nodes",
            "A degree-normalized companion to the Adamic-Adar predictor",
        ],
        references: [
            "Zhou, Lu, and Zhang, Predicting Missing Links via Local Information, 2009",
            "Liben-Nowell and Kleinberg, The Link-Prediction Problem for Social Networks, 2007",
        ],
        workedExample:
            "If A and D share neighbors X of degree 2 and Y of degree 4, the resource score is 1/2 + 1/4 = 0.75. A pair sharing only a high-degree hub of degree 10 would score just 0.1, so the low-degree route predicts a stronger link.",
    },
    id: "resource-allocation-index",
    name: "Resource Allocation Index",
    category: "graph",
    complexity: { time: "O(P * min(deg(u), deg(v)))", space: "O(V + E)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"], ["D", "E"]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build neighbor sets and record every vertex degree",
        "list every non-adjacent pair to evaluate",
        "for a pair find the neighbors shared by both ends",
        "add one over the degree of each shared neighbor",
        "repeat for all candidate pairs",
        "rank pairs by descending resource score",
        "done: report the best predicted link",
    ],
};

export default module;
