/**
 * rural-postman-problem.ts - Undirected Rural Postman via Minimum T-Join
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The rural postman must traverse a chosen subset of required edges and return
 * to the start, traveling other edges only as connectors. Required edges are
 * paid for once. Any remaining edges must repair the odd-degree vertices of
 * the required subgraph so the closed walk is even everywhere; that repair is
 * a minimum-weight perfect matching (a T-join) under all-pairs shortest paths.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^3 + 2^T * T^2), T = number of odd required vertices
 *   Space: O(V^2 + 2^T)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Required edges are YELLOW (highlight), connector edges stay idle.
 *   - The current required edge flashes CYAN (path) while it is summed.
 *   - Odd-degree required vertices turn RED (error) until they are paired.
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

const INF = 1e9;

function undirectedKey(a: string, b: string): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { graph?: Record<string, Array<[string, number]>>; required?: Array<[string, string]> } | null
    ) ?? {};
    const graph: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 1],
            ["E", 5],
        ],
        B: [
            ["A", 1],
            ["C", 1],
            ["D", 2],
        ],
        C: [
            ["B", 1],
            ["D", 1],
        ],
        D: [
            ["C", 1],
            ["B", 2],
            ["E", 1],
        ],
        E: [
            ["D", 1],
            ["A", 5],
        ],
    };
    const required: Array<[string, string]> = task.required ?? [
        ["A", "B"],
        ["B", "C"],
        ["C", "D"],
        ["D", "E"],
    ];

    const vertices: string[] = [];
    const seenVertex = new Set<string>();
    for (const v of Object.keys(graph)) {
        if (!seenVertex.has(v)) {
            seenVertex.add(v);
            vertices.push(v);
        }
        for (const [nb] of graph[v] ?? []) {
            if (!seenVertex.has(nb)) {
                seenVertex.add(nb);
                vertices.push(nb);
            }
        }
    }
    for (const [a, b] of required) {
        for (const v of [a, b]) {
            if (!seenVertex.has(v)) {
                seenVertex.add(v);
                vertices.push(v);
            }
        }
    }

    const nodes = makeGraphNodes(vertices.length > 0 ? vertices : ["A"]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const weight = new Map<string, number>();
    const unique: Array<[string, string, number]> = [];
    for (const [a, list] of Object.entries(graph)) {
        for (const [b, w] of list) {
            const key = undirectedKey(a, b);
            const prior = weight.get(key);
            if (prior === undefined || w < prior) weight.set(key, w);
            if (!unique.some(([x, y]) => undirectedKey(x, y) === key)) unique.push([a, b, w]);
        }
    }
    const requiredKeys = new Set(required.map(([a, b]) => undirectedKey(a, b)));
    const edges: VisualEdge[] = unique.map(([a, b, w]) => ({
        id: `edge-${undirectedKey(a, b)}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(w),
        state: requiredKeys.has(undirectedKey(a, b)) ? ("highlight" as const) : ("idle" as const),
        directed: false,
    }));

    let step = 0;
    const snap = (
        description: string,
        line: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber: line,
        layout: "graph",
        meta,
    });

    if (vertices.length === 0 || required.length === 0) {
        yield snap("No required edges - an empty closed walk costs zero.", 7, {
            requiredSum: 0,
            matchingCost: 0,
            answer: 0,
            odd: "",
        });
        return;
    }

    yield snap(`Rural postman on ${vertices.length} vertices with ${required.length} required edge(s).`, 0, {
        requiredSum: 0,
        matchingCost: 0,
        answer: 0,
        odd: "",
    });
    step += 1;

    const index = new Map(vertices.map((v, i) => [v, i]));
    const n = vertices.length;
    const dist: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(INF));
    for (let i = 0; i < n; i += 1) (dist[i] as number[])[i] = 0;
    for (const [a, list] of Object.entries(graph)) {
        const ia = index.get(a);
        if (ia === undefined) continue;
        for (const [b, w] of list) {
            const ib = index.get(b);
            if (ib === undefined) continue;
            if (w < (dist[ia] as number[])[ib]) {
                (dist[ia] as number[])[ib] = w;
                (dist[ib] as number[])[ia] = w;
            }
        }
    }
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const via = (dist[i] as number[])[k] + (dist[k] as number[])[j];
                if (via < (dist[i] as number[])[j]) (dist[i] as number[])[j] = via;
            }
        }
    }

    let requiredSum = 0;
    const degree = new Map<string, number>();
    for (const [a, b] of required) {
        const w = weight.get(undirectedKey(a, b)) ?? INF;
        requiredSum += w;
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
        const edge = edges.find((e) => e.id === `edge-${undirectedKey(a, b)}`);
        if (edge) edge.state = "path";
        yield snap(`Add required edge ${a}-${b} of cost ${w}; running total ${requiredSum}.`, 2, {
            requiredSum,
            matchingCost: 0,
            answer: 0,
            odd: "",
        });
        step += 1;
    }

    const odd = vertices.filter((v) => (degree.get(v) ?? 0) % 2 === 1);
    for (const v of odd) {
        const node = byId.get(`node-${v}`);
        if (node) node.state = "error";
    }
    yield snap(`Odd required vertices: ${odd.join(", ") || "none"} must be paired.`, 3, {
        requiredSum,
        matchingCost: 0,
        answer: 0,
        odd: odd.join("|"),
    });
    step += 1;

    const m = odd.length;
    let matchingCost = 0;
    if (m > 0) {
        const full = (1 << m) - 1;
        const dp: number[] = Array<number>(full + 1).fill(INF);
        dp[0] = 0;
        for (let mask = 1; mask <= full; mask += 1) {
            let i = 0;
            while (((mask >> i) & 1) === 0) i += 1;
            const rest = mask ^ (1 << i);
            for (let j = 0; j < m; j += 1) {
                if ((rest & (1 << j)) === 0) continue;
                const vi = index.get(odd[i] as string) as number;
                const vj = index.get(odd[j] as string) as number;
                const pairCost = (dist[vi] as number[])[vj] + (dp[rest ^ (1 << j)] as number);
                if (pairCost < (dp[mask] as number)) dp[mask] = pairCost;
            }
        }
        matchingCost = dp[full] as number;
    }
    yield snap(
        `Minimum pairing of odd vertices costs ${matchingCost} using shortest connector paths.`,
        5,
        { requiredSum, matchingCost, answer: 0, odd: odd.join("|") },
    );
    step += 1;

    for (const node of nodes) node.state = "visited";
    for (const edge of edges) {
        if (edge.state === "highlight") edge.state = "path";
    }
    const answer = requiredSum + matchingCost;
    yield snap(
        `Shortest closed postman tour costs ${answer} = ${requiredSum} required + ${matchingCost} connectors.`,
        7,
        { requiredSum, matchingCost, answer, odd: odd.join("|"), oddCount: m },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "You must cover only the required roads, but the closed walk has to enter and leave each region an even number of times. Required edges already force odd degree at some junctions. Pair those odd junctions up with the cheapest connector paths, and the required edges plus those connectors form an even graph you can traverse as a closed tour.",
        invariants: [
            "Every required edge is traversed at least once and paid for exactly once.",
            "The number of odd-degree required vertices is always even.",
            "A minimum perfect matching on the odd vertices under shortest-path distance equals a minimum T-join.",
        ],
        correctness:
            "A closed walk uses each edge an even number of times overall, so the parity of extra edges must match the parity contributed by the required subgraph: odd exactly at the T set of required-odd vertices. Thus the extra cost is a minimum T-join, which in an undirected graph equals the minimum-weight perfect matching on T under the shortest-path metric. The Floyd-Warshall matrix supplies those metric distances and the bitmask DP finds the exact matching, giving the optimal tour cost when the required subgraph is connected.",
        complexityRationale:
            "All-pairs shortest paths cost O(V cubed). The matching DP over 2 to the T subsets with T choices per subset costs O(2 to the T times T squared), exponential in the number of odd junctions, which is small in practice.",
        uses: [
            "Mail delivery and meter reading routes that must cover selected streets",
            "Inspection routes restricted to a required set of links",
            "A generalization of the Chinese postman problem to partial coverage",
        ],
        references: [
            "Orloff, A Fundamental Problem in Vehicle Routing, 1974",
            "Edmonds and Johnson, Matching, Euler Tours and the Chinese Postman, 1973",
        ],
        workedExample:
            "Required edges A-B, B-C, C-D, D-E have total cost 4 and leave only A and E odd. The shortest A-E connector costs 4, so the minimum closed tour costs 4 plus 4 equals 8, matching the walk A-B-C-D-E-D-C-B-A.",
    },
    id: "rural-postman-problem",
    name: "Rural Postman Problem",
    category: "graph",
    complexity: { time: "O(V^3 + 2^T * T^2)", space: "O(V^2 + 2^T)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 1],
                ["E", 5],
            ],
            B: [
                ["A", 1],
                ["C", 1],
                ["D", 2],
            ],
            C: [
                ["B", 1],
                ["D", 1],
            ],
            D: [
                ["C", 1],
                ["B", 2],
                ["E", 1],
            ],
            E: [
                ["D", 1],
                ["A", 5],
            ],
        },
        required: [
            ["A", "B"],
            ["B", "C"],
            ["C", "D"],
            ["D", "E"],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build all-pairs shortest paths with Floyd-Warshall",
        "sum the cost of every required edge",
        "record the required-subgraph degree of each endpoint",
        "collect the odd-degree vertices into set T",
        "compute minimum-weight perfect matching on T",
        "matching cost is a minimum T-join over shortest paths",
        "answer is required sum plus matching cost",
        "done: report the shortest closed postman tour cost",
    ],
};

export default module;
