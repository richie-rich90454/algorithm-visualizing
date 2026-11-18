/**
 * graph-of-thoughts.ts - Best-First Thought Expansion and Aggregation
 *
 * Scope: Graph of Thoughts models reasoning as a graph whose nodes are partial
 * thoughts and edges are transformations, then scores and aggregates them. The
 * teachable core implemented here is best-first expansion of a scored thought
 * graph followed by aggregation of the highest-scoring root-to-leaf path. The
 * thought scores are fixed toy heuristics, not language-model evaluations.
 *
 * Time:  O(V + E) for V thoughts and E transformations
 * Space: O(V)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GotInput {
    scores?: number[];
    edges?: Array<[number, number]>;
    maxExpansions?: number;
}

const DEFAULT_SCORES = [1, 3, 2, 5, 2, 4, 6, 1];
const DEFAULT_EDGES: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 4],
    [2, 5],
    [3, 6],
    [4, 6],
    [4, 7],
    [5, 7],
];

/** Build thought nodes for a frame with per-node states. */
function makeNodes(
    scores: number[],
    states: Map<number, EntityState>,
    pathScore: Map<number, number>,
): VisualEntity[] {
    return scores.map((score, index) => ({
        id: `thought-${index}`,
        type: "node" as const,
        label: `${index}:${score}`,
        value: score,
        state: states.get(index) ?? ("idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, score, best: pathScore.get(index) ?? 0 },
    }));
}

/** Edges between thoughts with per-edge states. */
function makeEdges(
    edges: Array<[number, number]>,
    active: (from: number, to: number) => EntityState,
): Array<{
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
}> {
    return edges.map(([from, to]) => ({
        id: `edge-${from}-${to}`,
        sourceId: `thought-${from}`,
        targetId: `thought-${to}`,
        label: "transform",
        state: active(from, to),
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GotInput | null) ?? {};
    const scores = Array.isArray(task.scores) && task.scores.length > 0 ? [...task.scores] : [...DEFAULT_SCORES];
    const edges: Array<[number, number]> =
        Array.isArray(task.edges) && task.edges.length > 0
            ? task.edges.map((edge) => [edge[0], edge[1]])
            : DEFAULT_EDGES.map((edge) => [edge[0], edge[1]]);
    const maxExpansions = Math.max(1, Math.trunc(task.maxExpansions ?? scores.length));

    const children = new Map<number, number[]>();
    const parents = new Map<number, number[]>();
    for (const [from, to] of edges) {
        children.set(from, [...(children.get(from) ?? []), to]);
        parents.set(to, [...(parents.get(to) ?? []), from]);
    }

    // Aggregation: best root-to-leaf score for each node (dynamic over the DAG).
    const bestScore: number[] = Array(scores.length).fill(-Infinity);
    const bestParent: number[] = Array(scores.length).fill(-1);
    bestScore[0] = scores[0] ?? 0;
    for (let i = 0; i < scores.length; i += 1) {
        if (i === 0) {
            continue;
        }
        let top = -Infinity;
        let topParent = -1;
        for (const parent of parents.get(i) ?? []) {
            if ((bestScore[parent] ?? -Infinity) > top) {
                top = bestScore[parent] ?? -Infinity;
                topParent = parent;
            }
        }
        bestScore[i] = (scores[i] ?? 0) + (Number.isFinite(top) ? top : 0);
        bestParent[i] = topParent;
    }
    const pathScoreMap = new Map<number, number>();
    bestScore.forEach((value, i) => pathScoreMap.set(i, Number.isFinite(value) ? value : 0));

    let step = 0;
    const initialStates = new Map<number, EntityState>([[0, "pivot"]]);
    yield {
        stepNumber: step,
        entities: makeNodes(scores, initialStates, pathScoreMap),
        edges: makeEdges(edges, () => "idle"),
        description: `Expanding a scored thought graph of ${scores.length} nodes by best-first search.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {
            nodeCount: scores.length,
            scores,
            edgeList: edges.map(([from, to]) => `${from}-${to}`),
            selectedPath: [],
            pathScore: 0,
            expansions: 0,
        },
    };
    step += 1;

    const generated = new Set<number>([0]);
    const expanded = new Set<number>();
    const frontier: number[] = [0];
    let expansions = 0;

    while (frontier.length > 0 && expansions < maxExpansions) {
        frontier.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
        const node = frontier.shift();
        if (node === undefined) {
            break;
        }
        expansions += 1;
        expanded.add(node);
        for (const child of children.get(node) ?? []) {
            if (!generated.has(child)) {
                generated.add(child);
                frontier.push(child);
            }
        }

        const states = new Map<number, EntityState>();
        for (const id of generated) {
            if (expanded.has(id)) {
                states.set(id, "visited");
            } else if (frontier.includes(id)) {
                states.set(id, "comparing");
            } else {
                states.set(id, "idle");
            }
        }
        yield {
            stepNumber: step,
            entities: makeNodes(scores, states, pathScoreMap),
            edges: makeEdges(edges, (from, to) => (from === node && (children.get(node) ?? []).includes(to) ? "active" : "idle")),
            description: `Expanded thought ${node} (score ${scores[node]}); added ${(children.get(node) ?? []).length} child thought(s) to the frontier.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: {
                nodeCount: scores.length,
                scores,
                edgeList: edges.map(([from, to]) => `${from}-${to}`),
                selectedPath: [],
                pathScore: 0,
                expansions,
            },
        };
        step += 1;
    }

    // Select the generated leaf with the highest aggregated path score.
    let bestLeaf = 0;
    let bestValue = -Infinity;
    for (const id of generated) {
        if ((children.get(id) ?? []).length === 0 && (bestScore[id] ?? -Infinity) > bestValue) {
            bestValue = bestScore[id] ?? -Infinity;
            bestLeaf = id;
        }
    }
    const selectedPath: number[] = [];
    let cursor: number = bestLeaf;
    const guard = scores.length + 1;
    for (let i = 0; i < guard && cursor >= 0; i += 1) {
        selectedPath.unshift(cursor);
        cursor = bestParent[cursor] ?? -1;
    }
    const finalStates = new Map<number, EntityState>();
    for (const id of generated) {
        finalStates.set(id, selectedPath.includes(id) ? "path" : "visited");
    }
    yield {
        stepNumber: step,
        entities: makeNodes(scores, finalStates, pathScoreMap),
        edges: makeEdges(edges, (from, to) =>
            selectedPath.includes(from) && selectedPath.includes(to) && selectedPath.indexOf(to) === selectedPath.indexOf(from) + 1
                ? "path"
                : "idle",
        ),
        description: `Selected thought path ${selectedPath.join(" -> ")} with aggregated score ${Number.isFinite(bestValue) ? bestValue : 0} after ${expansions} expansion(s).`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            nodeCount: scores.length,
            scores,
            edgeList: edges.map(([from, to]) => `${from}-${to}`),
            selectedPath,
            pathScore: Number.isFinite(bestValue) ? bestValue : 0,
            expansions,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Graph of Thoughts lets a reasoner branch, merge, and revisit ideas instead of following one line of thought. We model each idea as a scored node and each transformation as an edge. Best-first search expands the most promising frontier node, and aggregation combines node scores along a path to choose the strongest final thought.",
        invariants: [
            "Only generated thoughts can be expanded, and each is expanded at most once.",
            "A node's aggregated score is its own score plus the best aggregated score of any parent.",
            "The selected path starts at the root and ends at a generated leaf.",
        ],
        correctness:
            "Because the graph is acyclic and nodes are processed in dependency order, the dynamic program best(v) = score(v) + max over parents best(parent) computes the maximum root-to-v path sum. Enumerating only generated leaves can miss an unexpanded leaf, so with enough expansions the chosen leaf attains the global maximum path sum, which brute-force enumeration confirms.",
        complexityRationale:
            "Each of the V nodes is pushed once and each of the E edges is examined when its parent is expanded, so best-first expansion is O(V log V + E) with sorting, or O(V + E) with a heap. Storing scores and paths uses O(V) space.",
        uses: [
            "Structuring multi-step reasoning in language model agents",
            "Selecting the best solution among branching derivations",
            "Teaching graph search with scoring and aggregation",
        ],
        references: [
            "Besta et al., Graph of Thoughts: Solving Elaborate Problems with Large Language Models, 2023",
            "Yao et al., Tree of Thoughts: Deliberate Problem Solving with Large Language Models, 2023",
        ],
        workedExample:
            "With scores 1 at the root, children 3 and 2, and leaves 6 and 1, best-first expands the score-3 child first. Aggregation gives the path root to score-3 to score-6 a total of 1 + 3 + 6 = 10, the highest among the leaves, so that path is selected.",
    },
    id: "graph-of-thoughts",
    name: "Graph of Thoughts (Best-First Aggregation)",
    category: "ml-ai",
    complexity: { time: "O(V log V + E)", space: "O(V)" },
    defaultInput: { scores: DEFAULT_SCORES, edges: DEFAULT_EDGES, maxExpansions: 8 },
    visualType: "graph",
    run,
    pseudocode: [
        "build child and parent lists from the thought edges",
        "compute each node's aggregated best root-to-node score",
        "place the root in the frontier",
        "while the frontier is not empty and expansions remain",
        "pop the highest-scoring frontier node and expand its children",
        "after expansion pick the generated leaf with the best aggregated score",
        "reconstruct and report the selected thought path",
    ],
};

export default module;
