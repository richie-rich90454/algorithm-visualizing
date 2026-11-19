/**
 * clique-decomposition.ts - Minimum Edge Clique Decomposition
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An edge clique decomposition partitions the edge set of a graph into the
 * fewest complete subgraphs (cliques), every edge belonging to exactly one
 * clique. This differs from vertex clique cover, which partitions vertices.
 * The minimum number of cliques needed is the intersection number of the graph.
 * The algorithm lists every maximal clique with Bron-Kerbosch and then solves
 * an exact set cover over the edges, choosing a clique that covers a still
 * uncovered edge and pruning branches that cannot beat the incumbent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(3^(V/3) + 2^C) for C maximal cliques in the worst case
 *   Space: O(V + E + C) for cliques, edge masks, and search state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices of the clique being examined are CYAN.
 *   - Vertices of cliques already chosen for the cover are GREEN.
 *   - meta carries the maximal cliques, the chosen cover, and its size.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

interface Clique {
    members: number[];
    mask: Set<number>;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Adj } | null) ?? {};
    const raw: Adj = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D", "E"],
        D: ["C", "E"],
        E: ["C", "D"],
    };

    const labels = [
        ...new Set([...Object.keys(raw), ...Object.values(raw).flat().map((value) => String(value))]),
    ].sort();
    const n = labels.length;
    const index = new Map(labels.map((label, i) => [label, i] as [string, number]));
    const adjacency: boolean[][] = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
    const edgesList: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (const neighbor of raw[labels[i] as string] ?? []) {
            const j = index.get(String(neighbor));
            if (j === undefined || i === j) {
                continue;
            }
            adjacency[i]![j] = true;
            adjacency[j]![i] = true;
        }
    }
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (adjacency[i]![j]) {
                edgesList.push([i, j]);
            }
        }
    }
    const edgeCount = edgesList.length;
    const edgeIndex = new Map(edgesList.map((edge, i) => [edge.join("|"), i] as [string, number]));

    const nodes: VisualEntity[] = makeGraphNodes(labels);
    const edges: VisualEdge[] = edgesList.map(([i, j], k) => ({
        id: `edge-${k}`,
        sourceId: `node-${labels[i]}`,
        targetId: `node-${labels[j]}`,
        label: "",
        state: "idle",
        directed: false,
    }));

    let step = 0;
    const frame = (
        description: string,
        line: number,
        highlight: Set<number>,
        chosen: Clique[],
        coverSize: number | null,
        maximalCount: number,
    ): VisualFrame => {
        const chosenVertices = new Set<number>();
        for (const clique of chosen) {
            for (const member of clique.members) {
                chosenVertices.add(member);
            }
        }
        const entities = nodes.map((node, i) => ({
            ...node,
            state: (highlight.has(i)
                ? "active"
                : chosenVertices.has(i)
                  ? "sorted"
                  : "unvisited") as EntityState,
        }));
        return {
            stepNumber: step,
            entities,
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                coverSize: coverSize ?? 0,
                finalized: coverSize !== null,
                maximalCount,
                cover: chosen.map((clique) => clique.members.map((i) => labels[i]).join("+")),
                edgeCount,
            },
        };
    };

    yield frame(`Decomposing the edges of a ${n}-vertex graph into the fewest cliques.`, 0, new Set(), [], null, 0);
    step += 1;

    if (edgeCount === 0) {
        yield frame("A graph with no edges needs zero cliques.", 7, new Set(), [], 0, 0);
        step += 1;
        return;
    }

    const maximalCliques: Clique[] = [];
    const bronKerbosch = (current: number[], candidates: Set<number>, excluded: Set<number>): void => {
        if (candidates.size === 0 && excluded.size === 0) {
            const mask = new Set<number>();
            for (let a = 0; a < current.length; a += 1) {
                for (let b = a + 1; b < current.length; b += 1) {
                    const e = edgeIndex.get([current[a], current[b]].sort((x, y) => x - y).join("|"));
                    if (e !== undefined) {
                        mask.add(e);
                    }
                }
            }
            maximalCliques.push({ members: [...current].sort((a, b) => a - b), mask });
            return;
        }
        const pivotPool = new Set([...candidates, ...excluded]);
        let pivot = -1;
        let bestDegree = -1;
        for (const v of pivotPool) {
            let degree = 0;
            for (const u of candidates) {
                if (adjacency[v]![u]) {
                    degree += 1;
                }
            }
            if (degree > bestDegree) {
                bestDegree = degree;
                pivot = v;
            }
        }
        const extended = new Set<number>();
        for (const v of candidates) {
            if (pivot === -1 || !adjacency[v]![pivot]) {
                extended.add(v);
            }
        }
        for (const v of [...extended]) {
            const nextCandidates = new Set<number>();
            const nextExcluded = new Set<number>();
            for (const u of candidates) {
                if (adjacency[v]![u]) {
                    nextCandidates.add(u);
                }
            }
            for (const u of excluded) {
                if (adjacency[v]![u]) {
                    nextExcluded.add(u);
                }
            }
            bronKerbosch([...current, v], nextCandidates, nextExcluded);
            candidates.delete(v);
            excluded.add(v);
        }
    };
    bronKerbosch([], new Set(Array.from({ length: n }, (_value, i) => i)), new Set());

    for (const clique of maximalCliques) {
        yield frame(
            `Maximal clique {${clique.members.map((i) => labels[i]).join(", ")}} covers ${clique.mask.size} edge(s).`,
            2,
            new Set(clique.members),
            [],
            null,
            maximalCliques.length,
        );
        step += 1;
    }

    let bestCount = Infinity;
    let bestCover: Clique[] = [];
    const exactCover = (covered: Set<number>, chosen: Clique[]): void => {
        if (chosen.length >= bestCount) {
            return;
        }
        if (covered.size === edgeCount) {
            bestCount = chosen.length;
            bestCover = [...chosen];
            return;
        }
        let uncovered = -1;
        for (let e = 0; e < edgeCount; e += 1) {
            if (!covered.has(e)) {
                uncovered = e;
                break;
            }
        }
        for (const clique of maximalCliques) {
            if (!clique.mask.has(uncovered!)) {
                continue;
            }
            const next = new Set(covered);
            for (const e of clique.mask) {
                next.add(e);
            }
            chosen.push(clique);
            exactCover(next, chosen);
            chosen.pop();
        }
    };
    exactCover(new Set(), []);

    for (let i = 0; i < bestCover.length; i += 1) {
        yield frame(
            `Cover step ${i + 1}/${bestCover.length}: add clique {${bestCover[i]!.members.map((member) => labels[member]).join(", ")}}.`,
            5,
            new Set(bestCover[i]!.members),
            bestCover.slice(0, i + 1),
            null,
            maximalCliques.length,
        );
        step += 1;
    }

    yield frame(
        `Minimum edge clique decomposition uses ${bestCount} clique(s): ${bestCover.map((clique) => `{${clique.members.map((i) => labels[i]).join(", ")}}`).join(" ")}.`,
        7,
        new Set(),
        bestCover,
        bestCount,
        maximalCliques.length,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each edge as a job that must be assigned to a complete substructure. Any clique can be grown to a maximal clique without losing coverage, so only maximal cliques need to be considered. Then cover the edges with the fewest maximal cliques using exact set cover: whenever an edge is uncovered, some chosen clique must contain it, so branch on exactly those cliques.",
        invariants: [
            "Every maximal clique produced by Bron-Kerbosch is complete and not contained in a larger clique.",
            "At each search node, covered is exactly the union of edge masks of the chosen cliques.",
            "bestCount is the smallest complete cover found so far.",
        ],
        correctness:
            "Bron-Kerbosch enumerates every maximal clique exactly once. Any edge clique cover can be extended so each of its cliques is maximal without increasing the number of cliques, so restricting the cover to maximal cliques preserves optima. The branch rule forces coverage of a fixed uncovered edge, examining all covers up to clique order, and pruning only removes branches that already match or exceed the incumbent; hence the smallest cover found is the minimum edge clique decomposition.",
        complexityRationale:
            "Bron-Kerbosch takes O(3^(V/3)) time to list maximal cliques. Exact set cover branches over cliques covering a chosen edge, bounded by 2^C in the worst case with C maximal cliques; each step manipulates edge masks of size at most E. Space holds the maximal cliques, their masks, and search state, O(V + E + C).",
        uses: [
            "Representing a graph as an intersection graph of sets",
            "Computing the intersection number of a compatibility graph",
            "Grouping pairwise conflicts into the fewest fully connected test batches",
        ],
        references: [
            "Garey and Johnson, Computers and Intractability, chapter on NP-complete graph problems",
            "Bron and Kerbosch, Algorithm 457: Finding All Cliques of an Undirected Graph, 1973",
        ],
        workedExample:
            "Two triangles A-B-C and C-D-E sharing vertex C have maximal cliques {A, B, C} and {C, D, E}. Their edge masks are disjoint and together cover all six edges, so the minimum edge clique decomposition has size two. A bare cycle A-B-C-D-A has no triangle, so each of its four edges needs its own two-vertex clique.",
    },
    id: "clique-decomposition",
    name: "Minimum Edge Clique Decomposition",
    category: "graph",
    complexity: { time: "O(3^(V/3) + 2^C)", space: "O(V + E + C)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D", "E"],
            D: ["C", "E"],
            E: ["C", "D"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected edge set from the adjacency",
        "enumerate all maximal cliques with Bron-Kerbosch",
        "compute the set of edges covered by each maximal clique",
        "start an empty cover and an empty set of covered edges",
        "pick an uncovered edge and branch on cliques containing it",
        "prune branches that already reach the best cover size",
        "when all edges are covered, record the cover if it is smallest",
        "report the minimum edge clique decomposition",
    ],
};

export default module;
