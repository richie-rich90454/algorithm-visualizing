/**
 * graphwave.ts - Heat Kernel Diffusion on Graphs (GraphWave Teaching Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * GraphWave embeds nodes by filtering the graph heat kernel at several
 * scales. This teaching model builds the random-walk transition matrix of an
 * undirected graph and repeatedly applies it to a unit mass at a source node.
 * The resulting probability distribution is a heat-kernel diffusion profile:
 * at small scales it is concentrated near the source and at larger scales it
 * spreads across the connected component. Because each step averages over
 * neighbors, the mass is always nonnegative and sums to one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * V^2) for the dense matrix-vector products
 *   Space: O(V^2) to hold the diffusion profiles
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their current share of diffused mass at each scale.
 *   - The source node starts GREEN; nodes receiving mass are HIGHLIGHT.
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeGraphEdges } from "./graph-util";

type Adjacency = Record<string, string[]>;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Adjacency; steps?: number } | null) ?? {};
    const graph: Adjacency = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C"],
        E: [],
    };
    const stepsInput = typeof task.steps === "number" ? task.steps : 4;
    const steps = Math.max(1, Math.min(8, Math.floor(stepsInput)));
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [from, targets] of Object.entries(graph)) {
        for (const to of targets) {
            if (from === to || !sets.has(from) || !sets.has(to)) continue;
            sets.get(from)?.add(to);
            sets.get(to)?.add(from);
        }
    }
    const n = labels.length;
    const nodes = makeGraphNodes(n > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(Object.fromEntries([...sets].map(([v, s]) => [v, [...s]])));

    // Row-stochastic random-walk matrix. Isolated nodes keep their own mass.
    const p: number[][] = labels.map((u) => {
        const nb = [...(sets.get(u) ?? [])];
        const row = new Array<number>(n).fill(0);
        if (nb.length === 0) {
            row[labels.indexOf(u)] = 1;
        } else {
            for (const v of nb) {
                const index = labels.indexOf(v);
                if (index >= 0) row[index] = 1 / nb.length;
            }
        }
        return row;
    });
    const spread = (vector: number[]): number[] => {
        const next = new Array<number>(n).fill(0);
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                next[j] = (next[j] as number) + (vector[i] as number) * (p[i] as number[])[j]!;
            }
        }
        return next;
    };

    if (n === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty graph - there is no heat kernel to diffuse.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { steps: 0, mass: 0, nodes: 0 },
        };
        return;
    }

    const source = 0;
    let vector = new Array<number>(n).fill(0);
    vector[source] = 1;
    let step = 0;
    const snap = (description: string, codeLineNumber: number, round: number, mass: number): VisualFrame => {
        for (const node of nodes) {
            const index = labels.indexOf(String(node.value));
            const share = vector[index] ?? 0;
            node.label = `${String(node.value)}:${share.toFixed(2)}`;
            node.state = index === source ? "sorted" : share > 0 ? "highlight" : ("unvisited" as EntityState);
        }
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                round,
                mass,
                source: labels[source] as string,
                distribution: vector.map((x) => Math.round(x * 1e6) / 1e6),
                nodes: n,
            },
        };
    };

    yield snap(
        `Source ${labels[source]} holds all mass at scale 0 of ${steps}.`,
        0,
        0,
        1,
    );
    step += 1;
    for (let round = 1; round <= steps; round += 1) {
        vector = spread(vector);
        const mass = vector.reduce((sum, x) => sum + x, 0);
        yield snap(
            `Scale ${round}: mass has spread to ${vector.filter((x) => x > 0).length} node(s), total mass ${mass.toFixed(6)}.`,
            3,
            round,
            Math.round(mass * 1e6) / 1e6,
        );
        step += 1;
    }

    const finalMass = vector.reduce((sum, x) => sum + x, 0);
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Heat kernel after ${steps} random-walk steps: mass ${finalMass.toFixed(6)} preserved across ${n} node(s).`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            steps,
            mass: Math.round(finalMass * 1e6) / 1e6,
            distribution: vector.map((x) => Math.round(x * 1e6) / 1e6),
            nodes: n,
            source: labels[source] as string,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Heat diffusion on a graph is a random walk repeated over many small steps. Starting with all mass on one node, each step shares that mass evenly across neighbors. Small numbers of steps describe local structure and large numbers describe global structure, which is why graph wavelets use several scales to embed nodes.",
        invariants: [
            "The transition matrix is row-stochastic, including a self-loop for isolated nodes.",
            "Every diffusion vector is nonnegative and its entries sum to one.",
            "Mass can only reach nodes in the source's connected component.",
        ],
        correctness:
            "Each diffusion step computes vector times a row-stochastic matrix, so the sum of the entries is preserved: sum_j next[j] equals sum_i vector[i] times the sum of row i, which equals sum_i vector[i]. Nonnegativity is preserved because every coefficient is nonnegative, and entries are zero exactly for nodes unreachable within that many steps.",
        complexityRationale:
            "Dense multiplication of an n-vector by an n by n transition matrix costs O(n^2) per scale, so the run takes O(steps * n^2) time. The transition matrix and stored distributions use O(n^2) space.",
        uses: [
            " node feature generation for machine learning on graphs",
            " multi-scale community detection",
            " smoothing signals over irregular domains",
        ],
        references: [
            "Coifman and Lafon, Diffusion Maps (2006)",
            "Chung, Spectral Graph Theory",
        ],
        workedExample:
            "On the path A-B-C with mass 1 at A, one random-walk step puts 1 on B (in the undirected symmetrized graph A has only neighbor B). The next step splits B's mass between A and C, giving 0.5, 0, 0.5. The total remains 1 after every step.",
    },
    id: "graphwave",
    name: "GraphWave (Heat Kernel Diffusion)",
    category: "graph",
    complexity: { time: "O(steps * V^2)", space: "O(V^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C"],
            E: [],
        },
        steps: 4,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "symmetrize the graph into undirected neighbor sets",
        "build the row-stochastic random-walk transition matrix",
        "place unit mass on the chosen source node",
        "for each scale multiply the mass vector by the transition matrix",
        "report the number of nodes reached and the total mass",
        "repeat until the requested number of scales is complete",
        "done: a diffusion profile that filters the graph heat kernel",
    ],
};

export default module;
