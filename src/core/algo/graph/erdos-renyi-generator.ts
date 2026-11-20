/**
 * erdos-renyi-generator.ts - Erdos-Renyi Random Graph (G(n, m))
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The G(n, m) model builds an undirected graph by choosing exactly m distinct
 * pairs from the n(n-1)/2 possible vertex pairs, each pair equally likely. A
 * seeded pseudo-random generator makes the result reproducible. This module
 * shuffles the full list of pairs and takes the first m, then shows the graph
 * one edge at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) to enumerate and shuffle all pairs
 *   Space: O(n^2) for the candidate pair list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes stay put while edges appear one by one.
 *   - The newest edge turns green, the rest are idle.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface GenInput {
    n?: number;
    m?: number;
    seed?: number;
}

/** Deterministic mulberry32 pseudo-random generator. */
function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GenInput | null) ?? {};
    const n = Math.max(2, Math.min(40, Math.floor(Number(task.n ?? 6)) || 6));
    const possible = (n * (n - 1)) / 2;
    const m = Math.max(0, Math.min(possible, Math.floor(Number(task.m ?? 8)) || 0));
    const seed = Math.floor(Number(task.seed ?? 1)) || 1;
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : ""));
    const rng = makeRng(seed);

    const allPairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            allPairs.push([i, j]);
        }
    }
    for (let i = allPairs.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const temp = allPairs[i] as [number, number];
        allPairs[i] = allPairs[j] as [number, number];
        allPairs[j] = temp;
    }
    const chosen = allPairs.slice(0, m);

    const nodes = makeGraphNodes(labels);
    const degree = new Array<number>(n).fill(0);
    const edgeLabels: string[] = [];
    const meta = (added: number, residual: number) => ({
        n,
        m,
        seed,
        added,
        edges: [...edgeLabels],
        degree: [...degree],
        residual,
    });
    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: [],
        description: `G(n,m) with n=${n} and m=${m}: shuffling ${possible} possible vertex pairs with seed ${seed}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: meta(0, possible),
    };
    step += 1;

    const edges: Array<{ id: string; sourceId: string; targetId: string; label: string; state: EntityState; directed: boolean }> = [];
    for (let index = 0; index < chosen.length; index += 1) {
        const pair = chosen[index] ?? [0, 0];
        const a = labels[pair[0] as number] ?? "";
        const b = labels[pair[1] as number] ?? "";
        const edge = {
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "active" as EntityState,
            directed: false,
        };
        edges.push(edge);
        degree[pair[0] as number] = (degree[pair[0] as number] ?? 0) + 1;
        degree[pair[1] as number] = (degree[pair[1] as number] ?? 0) + 1;
        edgeLabels.push(`${a}-${b}`);
        for (let e = 0; e < edges.length; e += 1) {
            edges[e]!.state = e === edges.length - 1 ? "active" : "idle";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: edges.map((edgeItem) => ({ ...edgeItem })),
            description: `Added edge ${index + 1} of ${m}: ${a}-${b}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: meta(index + 1, possible - index - 1),
        };
        step += 1;
    }

    for (const node of nodes) {
        node.state = "sorted";
    }
    for (const edge of edges) {
        edge.state = "idle";
    }
    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edgeItem) => ({ ...edgeItem })),
        description: `Finished G(${n},${m}) with ${m} distinct edges and ${nodes.length} vertices.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: meta(m, 0),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Erdos-Renyi G(n,m) model is the simplest random graph: fix the number of vertices and the number of edges, then pick which pairs are joined uniformly at random. It serves as a null model, because any structure it shows arises from chance alone. A seed makes the draw repeatable.",
        invariants: [
            "Exactly m distinct unordered pairs are selected from the n(n-1)/2 candidates.",
            "No self-loops or duplicate edges ever appear.",
            "The same seed always produces exactly the same edge set.",
        ],
        correctness:
            "Enumerating every unordered pair once gives the uniform sample space, and a Fisher-Yates shuffle with a seeded generator produces a uniformly random permutation of that space. Taking the first m entries therefore yields a uniformly random m-edge subset with no repeats, which is the definition of G(n,m).",
        complexityRationale:
            "Listing all pairs costs O(n^2), the shuffle is O(n^2), and taking a prefix is O(m); the candidate list dominates, so time and space are O(n^2).",
        uses: [
            "A null model for testing whether real networks have structure",
            "Generating synthetic inputs for algorithm benchmarks",
            "Modeling random interconnection patterns",
        ],
        references: [
            "Erdos and Renyi, On the Evolution of Random Graphs, 1960",
            "Gilbert, Random Graphs, 1959",
        ],
        workedExample:
            "With n=4 there are six possible pairs. Asking for m=3 and seed 1 might pick A-C, B-D, and A-D, producing three edges with degrees A=2, B=1, C=1, D=2 and no repeated pair.",
    },
    id: "erdos-renyi-generator",
    name: "Erdos-Renyi Generator",
    category: "graph",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { n: 6, m: 8, seed: 1 },
    visualType: "graph",
    run,
    pseudocode: [
        "let all pairs be every unordered pair of vertices",
        "shuffle all pairs with a seeded random generator",
        "choose the first m pairs as the edge set",
        "add each chosen edge to the graph",
        "update the degree of both endpoints",
        "done: report the generated graph",
    ],
};

export default module;
