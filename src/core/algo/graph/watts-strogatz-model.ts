/**
 * watts-strogatz-model.ts - Watts-Strogatz Small-World Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Watts-Strogatz model interpolates between a regular ring lattice and a
 * random graph. Start with every vertex joined to its k nearest neighbors on a
 * ring, then rewire each edge with probability p to a uniformly random vertex,
 * avoiding self-loops and duplicates. Small p keeps high clustering and adds a
 * few long-range shortcuts, producing the small-world effect.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * k) to build the lattice and process its edges
 *   Space: O(n + E) for the adjacency sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge under consideration flashes while a rewire is attempted.
 *   - The final frame shows the rewired small-world graph.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface GenInput {
    n?: number;
    k?: number;
    p?: number;
    seed?: number;
}

function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let value = Math.imul(state ^ (state >>> 15), 1 | state);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

const key = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GenInput | null) ?? {};
    const n = Math.max(4, Math.min(40, Math.floor(Number(task.n ?? 10)) || 10));
    let k = Math.max(2, Math.floor(Number(task.k ?? 4)) || 4);
    if (k % 2 !== 0) {
        k += 1;
    }
    k = Math.min(k, n - 1);
    const p = Math.max(0, Math.min(1, typeof task.p === "number" ? task.p : 0.3));
    const seed = Math.floor(Number(task.seed ?? 1)) || 1;
    const rng = makeRng(seed);
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : ""));
    const nodes = makeGraphNodes(labels);

    const edgeSet = new Set<string>();
    const lattice: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let offset = 1; offset <= k / 2; offset += 1) {
            const j = (i + offset) % n;
            const kk = key(i, j);
            if (!edgeSet.has(kk)) {
                edgeSet.add(kk);
                lattice.push([i, j]);
            }
        }
    }
    const adjacency: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
    for (const [a, b] of lattice) {
        adjacency[a]!.add(b);
        adjacency[b]!.add(a);
    }

    const degree = (): number[] => adjacency.map((set) => set.size);
    const edgeLabels = (): string[] => [...edgeSet].sort().map((pair) => {
        const [a, b] = pair.split("-").map(Number);
        return `${labels[a ?? 0]}-${labels[b ?? 0]}`;
    });
    const meta = (processed: number, rewired: number) => ({
        n,
        k,
        p,
        seed,
        processed,
        rewired,
        edgeCount: edgeSet.size,
        edges: edgeLabels(),
        degree: degree(),
    });

    let step = 0;
    const render = (edges: Array<{ id: string; sourceId: string; targetId: string; label: string; state: EntityState; directed: boolean }>, description: string, codeLineNumber: number, processed: number, rewired: number): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description,
        codeLineNumber,
        layout: "graph",
        meta: meta(processed, rewired),
    });
    const buildEdges = (): Array<{ id: string; sourceId: string; targetId: string; label: string; state: EntityState; directed: boolean }> =>
        [...edgeSet].sort().map((pair) => {
            const [a, b] = pair.split("-").map(Number);
            return {
                id: `edge-${labels[a ?? 0]}-${labels[b ?? 0]}`,
                sourceId: `node-${labels[a ?? 0]}`,
                targetId: `node-${labels[b ?? 0]}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            };
        });

    yield render(buildEdges(), `Ring lattice with n=${n} and k=${k}; rewiring each edge with probability ${p}.`, 0, 0, 0);
    step += 1;

    let rewired = 0;
    for (let index = 0; index < lattice.length; index += 1) {
        const [u, v] = lattice[index] ?? [0, 0];
        if (rng() < p) {
            const candidates: number[] = [];
            for (let w = 0; w < n; w += 1) {
                if (w === u || adjacency[u]!.has(w) || edgeSet.has(key(u, w))) {
                    continue;
                }
                candidates.push(w);
            }
            if (candidates.length > 0) {
                const target = candidates[Math.floor(rng() * candidates.length)] as number;
                edgeSet.delete(key(u, v));
                edgeSet.add(key(u, target));
                adjacency[u]!.delete(v);
                adjacency[v]!.delete(u);
                adjacency[u]!.add(target);
                adjacency[target]!.add(u);
                rewired += 1;
                const edges = buildEdges();
                const activeId = `edge-${labels[u]}-${labels[target]}`;
                const active = edges.find((edge) => edge.id === activeId);
                if (active) {
                    active.state = "active";
                }
                yield render(edges, `Rewired ${labels[u]}-${labels[v]} to ${labels[u]}-${labels[target]}.`, 3, index + 1, rewired);
                step += 1;
                continue;
            }
        }
        if (index % Math.max(1, Math.floor(lattice.length / 8)) === 0) {
            yield render(buildEdges(), `Considered lattice edge ${index + 1} of ${lattice.length}.`, 2, index + 1, rewired);
            step += 1;
        }
    }

    for (const node of nodes) {
        node.state = "sorted";
    }
    yield render(buildEdges(), `Small-world graph complete: ${rewired} rewire(s), ${edgeSet.size} edges.`, 6, lattice.length, rewired);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A ring lattice has high clustering but long path lengths; a random graph has short paths but almost no clustering. Watts and Strogatz bridge the two: start with the ring and randomly rewire a fraction p of its edges. Even a small p creates shortcuts that shrink path lengths while leaving most local triangles intact.",
        invariants: [
            "For p equal to zero the graph stays exactly k-regular on the ring.",
            "Rewiring never creates a self-loop or a duplicate edge.",
            "Each original lattice edge is considered at most once.",
        ],
        correctness:
            "The initial lattice joins each vertex to k/2 neighbors on either side, so every degree is k. Each edge is either kept or replaced by an edge to a vertex that is neither itself nor already a neighbor, so degrees are preserved and the graph stays simple. A uniform random test against p chooses which edges rewire, matching the Watts-Strogatz construction.",
        complexityRationale:
            "Building the lattice visits n times k/2 neighbors, and the rewire pass visits each of the roughly n*k/2 edges once with a linear scan for candidates, giving O(n*k) time and O(n+E) space for adjacency.",
        uses: [
            "Modeling social, neural, and power-grid small-world networks",
            "Studying how shortcuts affect diffusion and search",
            "A bridge between regular and random graph models",
        ],
        references: [
            "Watts and Strogatz, Collective Dynamics of Small-World Networks, 1998",
            "Newman, Networks: An Introduction, Chapter 10",
        ],
        workedExample:
            "With n=10 and k=4, each vertex starts joined to two neighbors on each side. Rewiring edge B-C to B-G with p greater than zero removes the local link B-C, adds the shortcut B-G, and leaves both degrees at four.",
    },
    id: "watts-strogatz-model",
    name: "Watts-Strogatz Model",
    category: "graph",
    complexity: { time: "O(n * k)", space: "O(n + E)" },
    defaultInput: { n: 10, k: 4, p: 0.3, seed: 1 },
    visualType: "graph",
    run,
    pseudocode: [
        "place n vertices on a ring",
        "join each vertex to k over two neighbors on each side",
        "for every lattice edge draw a random number",
        "with probability p rewire one end to a random new vertex",
        "skip choices that make a self-loop or duplicate edge",
        "repeat until all lattice edges are considered",
        "done: report the small-world graph",
    ],
};

export default module;
