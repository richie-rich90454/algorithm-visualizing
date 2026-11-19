/**
 * chordal-graph-recognition.ts - Chordal Graph Recognition via MCS
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A graph is chordal when every cycle of length four or more has a chord, an
 * edge joining two nonconsecutive vertices of the cycle. A graph is chordal if
 * and only if it has a perfect elimination ordering: an ordering of the
 * vertices in which the earlier neighbors of every vertex form a clique.
 * Maximum Cardinality Search (MCS) numbers the vertices by repeatedly taking
 * the unnumbered vertex with the most already-numbered neighbors. The produced
 * order is a perfect elimination ordering exactly when the graph is chordal.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for MCS plus O(V * E) to test the ordering
 *   Space: O(V + E) for the adjacency matrix, weights, and numbers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex selected by MCS is CYAN; already numbered vertices are GREEN.
 *   - A vertex whose earlier neighbors fail the clique test turns RED.
 *   - meta reports the MCS order and the final chordal verdict.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

const numberMap = (numbers: number[]): Map<number, number> =>
    new Map(numbers.map((value, index) => [index, value] as [number, number]));

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
    const edgeKeys = new Set<string>();
    for (const a of labels) {
        for (const neighbor of raw[a] ?? []) {
            const b = String(neighbor);
            const ai = index.get(a);
            const bi = index.get(b);
            if (ai === undefined || bi === undefined || ai === bi) {
                continue;
            }
            adjacency[ai]![bi] = true;
            adjacency[bi]![ai] = true;
            edgeKeys.add([a, b].sort().join("|"));
        }
    }

    const nodes: VisualEntity[] = makeGraphNodes(labels);
    const edges: VisualEdge[] = [...edgeKeys].sort().map((key, i) => {
        const [a, b] = key.split("|") as [string, string];
        return {
            id: `edge-${i}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "idle",
            directed: false,
        };
    });

    let step = 0;
    const frame = (
        description: string,
        line: number,
        states: Map<number, EntityState>,
        numbers: number[],
        chordal: boolean | null,
        violations: string[],
    ): VisualFrame => {
        const entities = nodes.map((node, i) => ({
            ...node,
            state: states.get(i) ?? (numbers[i] !== undefined && numbers[i]! > 0 ? "sorted" : "unvisited"),
            metadata: { ...node.metadata, mcsNumber: numbers[i] ?? -1 },
        }));
        const order = labels
            .map((_label, i) => i)
            .filter((i) => (numbers[i] ?? -1) > 0)
            .sort((a, b) => (numbers[a] ?? 0) - (numbers[b] ?? 0))
            .map((i) => labels[i] as string);
        return {
            stepNumber: step,
            entities,
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                chordal: chordal === true,
                recognized: chordal !== null,
                mcsOrder: order,
                violations: [...violations],
                vertexCount: n,
            },
        };
    };

    yield frame(`Testing chordality of a ${n}-vertex graph with maximum cardinality search.`, 0, new Map(), Array<number>(n).fill(-1), null, []);
    step += 1;

    if (n === 0) {
        yield frame("An empty graph is chordal by definition.", 7, new Map(), [], true, []);
        step += 1;
        return;
    }

    const weight = Array<number>(n).fill(0);
    const numbers = Array<number>(n).fill(-1);
    const order: number[] = Array<number>(n).fill(-1);

    for (let k = n; k >= 1; k -= 1) {
        let chosen = -1;
        for (let i = 0; i < n; i += 1) {
            if (numbers[i] !== -1) {
                continue;
            }
            if (chosen === -1 || weight[i]! > weight[chosen]! || (weight[i] === weight[chosen] && labels[i]! < labels[chosen]!)) {
                chosen = i;
            }
        }
        numbers[chosen] = k;
        order[k] = chosen;
        yield frame(
            `MCS step ${n - k + 1}/${n}: pick ${labels[chosen]} with number ${k} and weight ${weight[chosen]}.`,
            2,
            new Map([[chosen, "active" as EntityState]]),
            numbers,
            null,
            [],
        );
        step += 1;
        for (let j = 0; j < n; j += 1) {
            if (numbers[j] === -1 && adjacency[chosen]![j]) {
                weight[j] = (weight[j] ?? 0) + 1;
            }
        }
    }

    let chordal = true;
    const violations: string[] = [];
    for (let k = 1; k <= n; k += 1) {
        const vertex = order[k]!;
        const earlier: number[] = [];
        for (let j = 0; j < n; j += 1) {
            if (adjacency[vertex]![j] && numbers[j]! > k) {
                earlier.push(j);
            }
        }
        let isClique = true;
        for (let a = 0; a < earlier.length && isClique; a += 1) {
            for (let b = a + 1; b < earlier.length; b += 1) {
                if (!adjacency[earlier[a]!]![earlier[b]!]) {
                    isClique = false;
                    break;
                }
            }
        }
        if (!isClique) {
            chordal = false;
            violations.push(labels[vertex] as string);
        }
        yield frame(
            `Check ${labels[vertex]}: ${earlier.length} earlier neighbor(s) ${isClique ? "form a clique" : "do not form a clique"}.`,
            4,
            new Map([[vertex, isClique ? "visited" : "error"]]),
            numbers,
            null,
            [...violations],
        );
        step += 1;
    }

    yield frame(
        chordal
            ? `Graph is chordal: the MCS order is a perfect elimination ordering.`
            : `Graph is not chordal: ${violations.length} vertex(es) violate the clique condition.`,
        7,
        new Map(),
        numbers,
        chordal,
        violations,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A chordal graph has no long induced cycle, and that shape is exactly what a perfect elimination ordering describes. Maximum Cardinality Search repeatedly grabs the vertex touching the most already chosen vertices. If the resulting order lets every vertex's earlier neighbors all know each other, the graph is chordal; if not, an offending cycle must exist.",
        invariants: [
            "MCS assigns a distinct number from n down to 1 to every vertex.",
            "A vertex's weight counts how many already numbered neighbors it has.",
            "An earlier neighbor means a neighbor with a larger MCS number.",
        ],
        correctness:
            "A graph is chordal if and only if it admits a perfect elimination ordering, and Fulkerson and Gross proved that any MCS ordering is perfect elimination exactly when the graph is chordal. Therefore checking whether earlier neighbors form a clique for every vertex in the MCS order decides chordality correctly: a passing order certifies chordality, and a failing vertex exposes an induced cycle of length at least four among its earlier neighbors.",
        complexityRationale:
            "MCS scans all vertices to pick each of the n numbers and then scans neighbors to update weights, costing O(V + E) with an adjacency matrix it is O(V^2). Verifying the ordering inspects neighbor pairs for each vertex, bounded by O(V * E). Storing the matrix, weights, and numbers uses O(V + E) space.",
        uses: [
            "Sparse Cholesky factorization with no fill-in for linear systems",
            "Exact inference in Bayesian networks via junction trees",
            "Recognizing chordal structure to speed up constraint solving",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on graph algorithms",
            "Tarjan and Yannakakis, Simple Linear-Time Algorithms to Test Chordality, 1984",
        ],
        workedExample:
            "Two triangles A-B-C and C-D-E sharing vertex C form a chordal graph. MCS numbers A and B early so their earlier neighbors are singletons, and at C the earlier neighbors A and B are adjacent. A bare four-cycle A-B-C-D-A fails at D because its earlier neighbors A and C are not adjacent, so it is not chordal.",
    },
    id: "chordal-graph-recognition",
    name: "Chordal Graph Recognition",
    category: "graph",
    complexity: { time: "O(V * E)", space: "O(V + E)" },
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
        "build the undirected adjacency of the input graph",
        "set every vertex weight to zero and leave all unnumbered",
        "for k from n down to 1 pick the unnumbered vertex of largest weight",
        "give that vertex number k and raise the weights of its unnumbered neighbors",
        "for each vertex examine its neighbors with a larger number",
        "if those earlier neighbors are not pairwise adjacent, report failure",
        "if every vertex passes, the graph is chordal",
        "report the MCS order and the chordal verdict",
    ],
};

export default module;
