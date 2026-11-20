/**
 * adamic-adar-index.ts - Adamic-Adar Index
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Adamic-Adar index refines common-neighbor counting by weighting each
 * shared neighbor inversely to its popularity: a shared neighbor with few
 * connections is more informative than a hub everybody already touches. The
 * score of a pair is the sum of 1 / log(degree(w)) over the neighbors w they
 * share.
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
 *   - The scored pair turns yellow; informative shared neighbors turn green.
 *   - The final frame ranks all candidate pairs by weighted score.
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
            if (degree > 1) {
                score += 1 / Math.log(degree);
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
    const setup = snapshot(null, "Score each missing link by the rarity of its shared neighbors.", 0, []);
    setup.stepNumber = step;
    yield setup;
    step += 1;

    for (let index = 0; index < candidates.length; index += 1) {
        const result = results[index];
        const frame = snapshot(
            index,
            `Pair ${pairLabels[index]}: weighted score ${(result?.score ?? 0).toFixed(4)} from ${result?.shared.length ?? 0} shared neighbor(s).`,
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
            "Not all common neighbors are equally convincing. If two people share a friend who knows everybody, that says little; if they share a friend with only a few connections, the overlap is much stronger evidence. Adamic-Adar gives each common neighbor a weight that decreases with its own degree.",
        invariants: [
            "Only non-adjacent pairs of distinct vertices are scored.",
            "Each shared neighbor w contributes exactly 1 / log(degree(w)).",
            "A shared neighbor of degree one contributes nothing because its logarithm is zero.",
        ],
        correctness:
            "Because a common neighbor is adjacent to both endpoints, its degree is at least two and its logarithm is positive, so every contribution is well defined and nonnegative. Summing the per-neighbor weights over the exact intersection of neighbor sets reproduces the Adamic-Adar index, and a rarer shared neighbor contributes a larger term.",
        complexityRationale:
            "For each pair we inspect the smaller neighbor set and test membership in the other, costing O(min(deg(u), deg(v))) plus constant work per shared neighbor. Degrees are precomputed while building the adjacency, so space is O(V + E).",
        uses: [
            "Friend recommendation in large social networks",
            "Predicting citations and co-authorship links",
            "A degree-corrected baseline for link-prediction research",
        ],
        references: [
            "Adamic and Adar, Friends and Neighbors on the Web, 2003",
            "Liben-Nowell and Kleinberg, The Link-Prediction Problem for Social Networks, 2007",
        ],
        workedExample:
            "If A and D share a low-degree neighbor X of degree 2 and a hub Y of degree 10, the score is 1/log(2) + 1/log(10) about 1.44 + 0.43 = 1.87, giving X far more credit than Y for predicting the A-D link.",
    },
    id: "adamic-adar-index",
    name: "Adamic-Adar Index",
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
        "add one over the log of each shared neighbor's degree",
        "repeat for all candidate pairs",
        "rank pairs by descending weighted score",
        "done: report the best predicted link",
    ],
};

export default module;
