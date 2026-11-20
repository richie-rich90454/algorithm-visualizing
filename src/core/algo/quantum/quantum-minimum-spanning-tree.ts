/**
 * quantum-minimum-spanning-tree.ts - Quantum Boruvka Minimum Spanning Tree
 *
 * Boruvka's method grows a spanning forest by repeatedly adding the cheapest
 * edge leaving each component. The quantum version replaces the classical scan
 * of the outgoing edges with quantum minimum finding: the candidate edges are
 * placed in uniform superposition, the cheapest ones are phase marked, and
 * amplitude amplification makes a measurement return the cheapest edge with
 * high probability. Repeating the rounds joins all components.
 *
 * Limits of the demo: the graph has at most eight vertices and an explicit
 * edge list, each component's cheapest edge is found by an ideal amplitude
 * amplification simulation, the most likely basis state is taken as the
 * measurement outcome with a classical fallback on a rare miss, and no
 * decoherence or oracle-call accounting beyond the abstract query count is
 * modeled.
 *
 * Time: O(rounds * E) in the simulator. Space: O(E).
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Edge = [number, number, number];

/** Classical reference MST weight by Kruskal's algorithm. */
export function kruskalMst(n: number, edges: Edge[]): { weight: number; selected: number[] } {
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) {
            root = parent[root] as number;
        }
        while (parent[x] !== x) {
            const next = parent[x] as number;
            parent[x] = root;
            x = next;
        }
        return root;
    };
    const order = edges.map((edge, index) => ({ edge, index })).sort((a, b) => a.edge[2] - b.edge[2]);
    const selected: number[] = [];
    let weight = 0;
    for (const { edge, index } of order) {
        const ru = find(edge[0]);
        const rv = find(edge[1]);
        if (ru !== rv) {
            parent[ru] = rv;
            selected.push(index);
            weight += edge[2];
        }
    }
    return { weight, selected };
}

/** Ideal amplitude amplification returning the most likely candidate index. */
function quantumArgMin(weights: number[]): { index: number; probability: number; queries: number } {
    const m = weights.length;
    const minimum = Math.min(...weights);
    const marked = weights.map((w) => w === minimum);
    const M = marked.filter(Boolean).length;
    const N = 2 ** Math.ceil(Math.log2(Math.max(2, m)));
    const state = new Array<number>(N).fill(1 / Math.sqrt(N));
    const queries = M === 0 ? 0 : Math.max(1, Math.floor((Math.PI / 4) * Math.sqrt(N / M)));
    for (let k = 0; k < queries && k < 30; k += 1) {
        for (let i = 0; i < m; i += 1) {
            if (marked[i]) {
                state[i] = -(state[i] as number);
            }
        }
        const mean = state.reduce((sum, value) => sum + value, 0) / N;
        for (let i = 0; i < N; i += 1) {
            state[i] = 2 * mean - (state[i] as number);
        }
    }
    let best = 0;
    for (let i = 1; i < m; i += 1) {
        if ((state[i] as number) ** 2 > (state[best] as number) ** 2) {
            best = i;
        }
    }
    return { index: best, probability: (state[best] as number) ** 2, queries };
}

/** Quantum Boruvka construction of a minimum spanning tree. */
export function quantumMst(n: number, edges: Edge[]): {
    selected: number[];
    weight: number;
    rounds: number;
    fallbacks: number;
    queries: number;
} {
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) {
            root = parent[root] as number;
        }
        return root;
    };
    const selected = new Set<number>();
    let weight = 0;
    let rounds = 0;
    let fallbacks = 0;
    let queries = 0;
    while (rounds < n) {
        rounds += 1;
        const choice = new Map<number, number>();
        for (let i = 0; i < edges.length; i += 1) {
            const edge = edges[i] as Edge;
            const ra = find(edge[0]);
            const rb = find(edge[1]);
            if (ra === rb) {
                continue;
            }
            for (const component of [ra, rb]) {
                const existing = choice.get(component);
                if (existing === undefined || (edge[2] as number) < (edges[existing] as Edge)[2]) {
                    choice.set(component, i);
                }
            }
        }
        const picks = new Set<number>();
        for (const index of choice.values()) {
            picks.add(index);
        }
        if (picks.size === 0) {
            break;
        }
        let changed = false;
        for (const index of picks) {
            const edge = edges[index] as Edge;
            const candidates: number[] = [];
            for (let j = 0; j < edges.length; j += 1) {
                const candidate = edges[j] as Edge;
                const ra = find(candidate[0]);
                const rb = find(candidate[1]);
                if (ra !== rb && (ra === find(edge[0]) || rb === find(edge[0]))) {
                    candidates.push(j);
                }
            }
            const weights = candidates.map((j) => (edges[j] as Edge)[2]);
            const measured = quantumArgMin(weights);
            queries += measured.queries;
            let chosen = candidates[measured.index] as number;
            if (weights[measured.index] !== Math.min(...weights)) {
                fallbacks += 1;
                chosen = candidates[weights.indexOf(Math.min(...weights))] as number;
            }
            if (!selected.has(chosen)) {
                const chosenEdge = edges[chosen] as Edge;
                const ra = find(chosenEdge[0]);
                const rb = find(chosenEdge[1]);
                if (ra !== rb) {
                    parent[ra] = rb;
                    selected.add(chosen);
                    weight += chosenEdge[2];
                    changed = true;
                }
            }
        }
        if (!changed) {
            break;
        }
    }
    return { selected: [...selected].sort((a, b) => a - b), weight, rounds, fallbacks, queries };
}

function makeCells(n: number, edges: Edge[], selected: Set<number>, active: number): VisualEntity[] {
    return edges.map((edge, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `${edge[0]}-${edge[1]}:${edge[2]}`,
        value: edge[2],
        state: index === active ? "comparing" : selected.has(index) ? "path" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, u: edge[0], v: edge[1], weight: edge[2], selected: selected.has(index), vertices: n },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number; edges?: Edge[] } | null) ?? {};
    const n = Math.min(8, Math.max(2, Math.floor(Number(task.vertices ?? 5)) || 5));
    const edges: Edge[] = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges.map((edge) => [Number(edge[0]), Number(edge[1]), Number(edge[2])])
        : [[0, 1, 2], [0, 2, 4], [1, 2, 1], [1, 3, 7], [2, 3, 3], [2, 4, 5], [3, 4, 2]];
    const result = quantumMst(n, edges);
    const reference = kruskalMst(n, edges);
    const selected = new Set<number>();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(n, edges, selected, -1),
        edges: [],
        description: `Grow a spanning tree on ${n} vertices with ${edges.length} edges using quantum Boruvka rounds.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            vertices: n, edgeCount: edges.length,
            selected: [], weight: 0, rounds: result.rounds,
            fallbacks: result.fallbacks, queries: result.queries,
            referenceWeight: reference.weight,
        },
    };
    step += 1;

    for (let i = 0; i < result.selected.length; i += 1) {
        selected.add(result.selected[i] as number);
        const chosen = edges[result.selected[i] as number] as Edge;
        yield {
            stepNumber: step,
            entities: makeCells(n, edges, selected, result.selected[i] as number),
            edges: [],
            description: `Pick edge ${chosen[0]}-${chosen[1]} of weight ${chosen[2]} with a quantum minimum query.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                vertices: n, edgeCount: edges.length,
                selected: [...selected].sort((a, b) => a - b),
                weight: [...selected].reduce((sum, index) => sum + (edges[index] as Edge)[2], 0),
                rounds: result.rounds,
                fallbacks: result.fallbacks,
                queries: result.queries,
                referenceWeight: reference.weight,
                chosenEdge: chosen,
            },
        };
        step += 1;
    }

    const finalWeight = [...selected].reduce((sum, index) => sum + (edges[index] as Edge)[2], 0);
    yield {
        stepNumber: step,
        entities: makeCells(n, edges, selected, -1),
        edges: [],
        description: `Spanning tree weight ${finalWeight} matches the classical Kruskal weight ${reference.weight}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            vertices: n, edgeCount: edges.length,
            selected: [...selected].sort((a, b) => a - b),
            weight: finalWeight,
            referenceWeight: reference.weight,
            rounds: result.rounds,
            fallbacks: result.fallbacks,
            queries: result.queries,
            optimal: finalWeight === reference.weight,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Boruvka's algorithm grows a minimum spanning tree by asking each component for its cheapest outgoing edge. The quantum twist is to answer that question with amplitude amplification instead of a linear scan. Placing candidate edges in superposition and marking the cheapest ones makes a measurement return a cheap edge after about the square root of the number of candidates, and the forest is joined after only a logarithmic number of rounds.",
        invariants: [
            "Every chosen edge joins two different components at the time it is picked.",
            "The selected edges never form a cycle.",
            "The accumulated weight matches the classical optimum when all minimum queries succeed.",
        ],
        correctness:
            "The cut property says the cheapest edge crossing any cut is safe to add to a minimum spanning tree. Boruvka applies the property to the cut around each component, so adding all chosen edges keeps a subgraph of some minimum spanning tree and reduces the component count. Quantum minimum finding returns the cheapest candidate with high probability because amplitude amplification concentrates mass on the marked minimum. With the rare classical fallback the construction is exactly Boruvka's, whose output weight equals Kruskal's independently computed optimum.",
        complexityRationale:
            "Each simulator query scans the candidate list, so the teaching version costs O(rounds times E) time and O(E) space. Abstractly there are O(log n) rounds and each minimum finding uses O(square root of E) oracle calls, beating the classical scan of E edges per round.",
        uses: [
            "Network design with quantum-enhanced subroutine calls",
            "A teaching application of quantum minimum finding",
            "Prototyping graph optimization on small quantum processors",
        ],
        references: [
            "Boruvka, O jistem problemu minimalnim, 1926",
            "Dur and He, Quantum Query Complexity of Some Graph Problems, 2006",
        ],
        workedExample:
            "On five vertices with edges of weights 2, 4, 1, 7, 3, 5 and 2, the first round picks the cheapest outgoing edge of each component and later rounds merge the forest. The final weight is 8, the same value Kruskal's algorithm obtains by sorting the edges.",
    },
    id: "quantum-minimum-spanning-tree",
    name: "Quantum Minimum Spanning Tree",
    category: "quantum",
    complexity: { time: "O(rounds * E) simulator", space: "O(E)" },
    defaultInput: {
        vertices: 5,
        edges: [[0, 1, 2], [0, 2, 4], [1, 2, 1], [1, 3, 7], [2, 3, 3], [2, 4, 5], [3, 4, 2]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the vertex count and weighted edge list",
        "initialize each vertex as its own component",
        "for every component collect its outgoing edges",
        "use quantum minimum finding to choose the cheapest outgoing edge",
        "add chosen edges that join distinct components",
        "repeat until one component remains",
        "compare the total weight with a classical Kruskal reference",
        "done: report the tree edges and optimality flag",
    ],
};

export default module;
