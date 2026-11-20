/**
 * tree-decomposition.ts - Min-Fill Elimination Tree Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A tree decomposition groups vertices into bags arranged as a tree so that
 * every graph edge lies inside some bag and every vertex's bags form one
 * connected subtree. This module chooses a min-fill elimination order: at each
 * step it removes the vertex whose remaining neighbors need the fewest new
 * edges to become a clique. The eliminated vertex plus its neighbors form a
 * bag, and connecting each bag to the earliest-eliminated neighbor's bag gives
 * a valid decomposition whose largest bag minus one bounds the treewidth.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3) for repeated min-fill scoring and clique completion
 *   Space: O(V^2) for the filled adjacency and the bags
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bag is a graph node labeled with its vertex set.
 *   - Parent-child links of the decomposition tree are directed edges.
 *   - The bag created in the current step is YELLOW; finished bags are GREEN.
 */

import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";

const defaultEdges: Array<[string, string]> = [
    ["A", "B"],
    ["A", "C"],
    ["B", "C"],
    ["C", "D"],
    ["C", "E"],
    ["D", "E"],
    ["E", "F"],
    ["D", "F"],
];

interface Bag {
    members: string[];
    eliminated: string;
    step: number;
}

function decompose(nodes: string[], edges: Array<[string, string]>): {
    bags: Bag[];
    parents: Array<number | null>;
    fillCount: number;
} {
    const order = new Map(nodes.map((v, i) => [v, i]));
    const adjacency = new Map(nodes.map((v) => [v, new Set<string>()]));
    for (const [u, v] of edges) {
        adjacency.get(u)?.add(v);
        adjacency.get(v)?.add(u);
    }

    const bags: Bag[] = [];
    const remaining = new Set(nodes);
    let fillCount = 0;
    let step = 0;
    while (remaining.size > 0) {
        let chosen: string | null = null;
        let chosenFill = Infinity;
        for (const v of [...remaining].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))) {
            const neighbors = [...(adjacency.get(v) ?? [])].filter((u) => remaining.has(u));
            let fill = 0;
            for (let i = 0; i < neighbors.length; i += 1) {
                for (let j = i + 1; j < neighbors.length; j += 1) {
                    if (!adjacency.get(neighbors[i]!)?.has(neighbors[j]!)) {
                        fill += 1;
                    }
                }
            }
            if (fill < chosenFill) {
                chosenFill = fill;
                chosen = v;
            }
        }
        if (chosen === null) {
            break;
        }
        const neighbors = [...(adjacency.get(chosen) ?? [])]
            .filter((u) => remaining.has(u))
            .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
        bags.push({ members: [chosen, ...neighbors], eliminated: chosen, step });
        for (let i = 0; i < neighbors.length; i += 1) {
            for (let j = i + 1; j < neighbors.length; j += 1) {
                if (!adjacency.get(neighbors[i]!)?.has(neighbors[j]!)) {
                    fillCount += 1;
                }
                adjacency.get(neighbors[i]!)?.add(neighbors[j]!);
                adjacency.get(neighbors[j]!)?.add(neighbors[i]!);
            }
        }
        remaining.delete(chosen);
        step += 1;
    }

    const eliminatedAt = new Map(bags.map((bag) => [bag.eliminated, bag.step]));
    const parents = bags.map((bag) => {
        let parent: number | null = null;
        for (const member of bag.members) {
            if (member === bag.eliminated) {
                continue;
            }
            const at = eliminatedAt.get(member) ?? bag.step;
            if (parent === null || at < parent) {
                parent = at;
            }
        }
        return parent;
    });
    return { bags, parents, fillCount };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: Array<[string, string]> } | null) ?? {};
    const raw = Array.isArray(task.edges) ? task.edges : defaultEdges;
    const edges = raw
        .filter((e) => Array.isArray(e) && e.length >= 2)
        .map((e) => [String(e[0]), String(e[1])] as [string, string]);
    const nodes = [...new Set(edges.flat())];
    if (nodes.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no tree decomposition to build.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { width: -1, bags: [], order: [] },
        };
        return;
    }

    const { bags, parents, fillCount } = decompose(nodes, edges);
    const width = Math.max(...bags.map((bag) => bag.members.length)) - 1;
    let step = 0;

    const frame = (description: string, codeLineNumber: number, upto: number, active: number): VisualFrame => {
        const entities = bags.slice(0, upto).map((bag, i) => ({
            id: `bag-${i}`,
            type: "node" as const,
            label: `{${bag.members.join(",")}}`,
            value: bag.members.length,
            state: (i === active ? "comparing" : i === upto - 1 ? "visited" : "sorted") as "comparing" | "visited" | "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { bag: i, size: bag.members.length },
        }));
        const visualEdges: VisualEdge[] = [];
        for (let i = 0; i < upto; i += 1) {
            const parent = parents[i];
            if (parent !== null && parent < upto) {
                visualEdges.push({
                    id: `tree-${parent}-${i}`,
                    sourceId: `bag-${parent}`,
                    targetId: `bag-${i}`,
                    label: "",
                    state: "path",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step++,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                width,
                bags: bags.slice(0, upto).map((bag) => `{${bag.members.join(",")}}`),
                order: bags.slice(0, upto).map((bag) => bag.eliminated),
                fillCount,
                built: upto,
            },
        };
    };

    yield frame(`Building a min-fill tree decomposition for ${nodes.length} vertex(s) and ${edges.length} edge(s).`, 0, 0, -1);

    for (let i = 0; i < bags.length; i += 1) {
        const bag = bags[i]!;
        yield frame(
            `Eliminate ${bag.eliminated}: create bag {${bag.members.join(",")}} and connect it to the earliest-eliminated neighbor's bag.`,
            3,
            i + 1,
            i,
        );
    }

    yield frame(
        `Decomposition complete with ${bags.length} bag(s); largest bag has ${width + 1} vertex(s), so treewidth is at most ${width}.`,
        6,
        bags.length,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A tree decomposition trades a hard graph for a tree of small overlapping bags. Whenever you eliminate a vertex, all of its remaining neighbors must be mutually connected, so they are bundled into one bag together with the vertex. Joining each new bag to the bag where its earliest neighbor disappeared keeps the bags for any single vertex connected, which is exactly what makes dynamic programming over the tree valid.",
        invariants: [
            "Every original edge has both ends in at least one bag.",
            "For each vertex, the bags containing it form a connected subtree.",
            "Min-fill picks the vertex needing the fewest new edges at every step.",
        ],
        correctness:
            "Eliminating a vertex makes its remaining neighbors a clique, so any edge from the eliminated vertex is covered by its bag and all other edges survive into later bags. For a fixed vertex x, the bags containing x are those created before x is eliminated whose eliminated vertex is adjacent to x in the filled graph; because neighbors of any eliminated vertex form a clique, the parent links take each such bag upward to the next one that still contains x, so they form a connected chain. The tree therefore satisfies all three decomposition conditions, and its maximum bag size minus one bounds the treewidth.",
        complexityRationale:
            "Each of the V elimination steps scores up to V candidates by checking up to V squared neighbor pairs, giving O(V^3) time; completing cliques and storing bags uses O(V^2) space.",
        uses: [
            "Exact dynamic programming on graphs of small treewidth",
            "Join-tree inference in probabilistic graphical models",
            "Register allocation and constraint solving via elimination orders",
        ],
        references: [
            "Robertson and Seymour, Graph Minors II: Algorithmic Aspects of Treewidth, 1986",
            "Koller and Friedman, Probabilistic Graphical Models, chapter on join trees",
        ],
        workedExample:
            "On a triangle A-B-C with a tail C-D, min-fill removes A first with bag {A,B,C}, then B with bag {B,C}, then C with bag {C,D}, and finally D with bag {D}. Linking bag 0 to bag 1 and bag 1 to bag 2 covers every edge, and the largest bag has three vertices, giving width 2.",
    },
    id: "tree-decomposition",
    name: "Min-Fill Tree Decomposition",
    category: "graph",
    complexity: { time: "O(V^3)", space: "O(V^2)" },
    defaultInput: { edges: defaultEdges },
    visualType: "graph",
    run,
    pseudocode: [
        "start with the full adjacency of the graph",
        "while vertices remain, score each by its fill-in count",
        "choose the vertex whose neighbors need the fewest new edges",
        "create a bag of that vertex and its remaining neighbors",
        "connect the remaining neighbors into a clique",
        "link the new bag to the earliest-eliminated neighbor's bag",
        "remove the vertex and repeat until none remain",
        "done: report the bags, links, and treewidth upper bound",
    ],
};

export default module;
