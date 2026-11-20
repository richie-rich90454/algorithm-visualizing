/**
 * minimum-cycle-basis-horton.ts – Horton Minimum Cycle Basis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A cycle basis is a smallest set of cycles whose edge sets generate every
 * cycle of a graph under symmetric difference. Horton's algorithm builds a
 * candidate cycle for every edge and every source by joining the two shortest
 * paths from that source to the edge endpoints. Sorting those candidates by
 * weight and greedily keeping the ones independent over GF(2) yields a minimum
 * total-weight cycle basis.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E * alpha + E^3 / w) with bit-parallel Gaussian elimination
 *   Space: O(V * E + E^2 / w)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are BLUE.
 *   - Edges of the currently examined candidate are YELLOW.
 *   - Edges of cycles already accepted into the basis are PINK.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Accepted cycle vectors are linearly independent over GF(2).
 *   - The algorithm returns exactly the cycle-space dimension many cycles.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Candidate {
    mask: bigint;
    weight: number;
    edges: number[];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: Array<string | number>; edges?: Array<[string | number, string | number]> } | null) ?? {};
    const vertices = (task.vertices ?? [0, 1, 2, 3, 4, 5]).map((v) => Number(v));
    const incoming = (task.edges ?? [
        [0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3], [0, 3],
    ]).map(([a, b]) => [Number(a), Number(b)] as [number, number]);

    const indexOf = new Map<number, number>();
    vertices.forEach((v, i) => indexOf.set(v, i));
    const n = vertices.length;
    const m = incoming.length;
    const endA = incoming.map(([a]) => indexOf.get(a) as number);
    const endB = incoming.map(([, b]) => indexOf.get(b) as number);
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (let e = 0; e < m; e += 1) {
        adjacency[endA[e] as number]?.push(e);
        adjacency[endB[e] as number]?.push(e);
    }

    const otherEnd = (edge: number, node: number): number => (endA[edge] === node ? (endB[edge] as number) : (endA[edge] as number));

    const shortestPaths = (source: number): { dist: number[]; parent: number[] } => {
        const dist = new Array<number>(n).fill(Infinity);
        const parent = new Array<number>(n).fill(-1);
        dist[source] = 0;
        const queue = [source];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            for (const edge of adjacency[u] ?? []) {
                const v = otherEnd(edge, u);
                if (dist[v] === Infinity) {
                    dist[v] = (dist[u] as number) + 1;
                    parent[v] = edge;
                    queue.push(v);
                }
            }
        }
        return { dist, parent };
    };

    const pathMask = (source: number, target: number, dist: number[], parent: number[]): bigint => {
        let mask = 0n;
        let current = target;
        while (current !== source) {
            const edge = parent[current] as number;
            if (edge < 0) {
                return 0n;
            }
            mask |= 1n << BigInt(edge);
            current = otherEnd(edge, current);
        }
        return mask;
    };

    const candidates = new Map<string, Candidate>();
    for (let source = 0; source < n; source += 1) {
        const { dist, parent } = shortestPaths(source);
        for (let edge = 0; edge < m; edge += 1) {
            const u = endA[edge] as number;
            const v = endB[edge] as number;
            if (u === v || u > v || dist[u] === Infinity || dist[v] === Infinity) {
                continue;
            }
            const pu = pathMask(source, u, dist, parent);
            const pv = pathMask(source, v, dist, parent);
            const mask = (pu ^ pv) ^ (1n << BigInt(edge));
            if (mask === 0n) {
                continue;
            }
            const weight = (dist[u] as number) + 1 + (dist[v] as number);
            const existing = candidates.get(mask.toString());
            if (!existing || weight < existing.weight) {
                const edgeList: number[] = [];
                for (let e = 0; e < m; e += 1) {
                    if ((mask & (1n << BigInt(e))) !== 0n) {
                        edgeList.push(e);
                    }
                }
                candidates.set(mask.toString(), { mask, weight, edges: edgeList });
            }
        }
    }
    const ordered = [...candidates.values()].sort((a, b) => a.weight - b.weight);

    const unionParent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
        let root = x;
        while (unionParent[root] !== root) {
            root = unionParent[root] as number;
        }
        while (unionParent[x] !== x) {
            const next = unionParent[x] as number;
            unionParent[x] = root;
            x = next;
        }
        return root;
    };
    for (let e = 0; e < m; e += 1) {
        const a = find(endA[e] as number);
        const b = find(endB[e] as number);
        if (a !== b) {
            unionParent[a] = b;
        }
    }
    const components = new Set(Array.from({ length: n }, (_, i) => find(i))).size;
    const target = m - n + components;

    let step = 0;
    const acceptedEdges = new Set<number>();
    const accepted: number[][] = [];
    let totalWeight = 0;
    let viewing: number[] = [];

    const frame = (description: string, codeLineNumber: number): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((v) => ({
            id: `node-${v}`,
            type: "node" as const,
            label: String(v),
            value: v,
            state: "active" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { vertex: v },
        }));
        const visualEdges: VisualEdge[] = incoming.map(([a, b], e) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: acceptedEdges.has(e) ? ("path" as const) : viewing.includes(e) ? ("comparing" as const) : ("idle" as const),
            directed: false,
        }));
        return {
            stepNumber: step++,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { candidates: ordered.length, basisSize: accepted.length, totalWeight, target },
        };
    };

    const basis = new Map<number, bigint>();
    const leadingBit = (x: bigint): number => x.toString(2).length - 1;
    const addIndependent = (mask: bigint): boolean => {
        let x = mask;
        while (x !== 0n) {
            const bit = leadingBit(x);
            const existing = basis.get(bit);
            if (existing !== undefined) {
                x ^= existing;
            } else {
                basis.set(bit, x);
                return true;
            }
        }
        return false;
    };

    yield frame(`Generated ${ordered.length} candidate cycles; basis needs ${target}.`, 0);

    for (const candidate of ordered) {
        viewing = candidate.edges;
        if (!addIndependent(candidate.mask)) {
            yield frame(`Candidate of weight ${candidate.weight} is dependent; skipped.`, 3);
            continue;
        }
        accepted.push(candidate.edges);
        totalWeight += candidate.weight;
        for (const e of candidate.edges) {
            acceptedEdges.add(e);
        }
        yield frame(
            `Accepted cycle of weight ${candidate.weight}; ${accepted.length} of ${target} found.`,
            4,
        );
        if (accepted.length >= target) {
            break;
        }
    }

    viewing = [];
    yield frame(
        `Minimum cycle basis has ${accepted.length} cycle(s) with total weight ${totalWeight}.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The cycle space of a graph can be generated by many different sets of cycles. Horton's algorithm proposes one short cycle for every source and edge, then keeps the lightest cycles that add a genuinely new direction to the growing basis. Testing independence with bit vectors over GF(2) makes the greedy choice fast, and a theorem guarantees that the resulting set has minimum total weight.",
        invariants: [
            "Every accepted cycle vector is independent of the previously accepted ones over GF(2).",
            "The candidate cycles are examined in nondecreasing weight order.",
            "Symmetric difference of accepted cycles can reproduce every candidate cycle once the basis is complete.",
        ],
        correctness:
            "For every edge and source, the two shortest paths from the source to the edge endpoints plus that edge form a cycle; Horton proved that some minimum cycle basis is contained in this candidate set. Processing candidates in weight order and adding exactly those independent of the current span is the matroid greedy algorithm, which produces a minimum-weight basis of the cycle space.",
        complexityRationale:
            "Running breadth-first search from every source costs O(V E), and building candidates plus sorting is bounded by O(E^2 log E). Gaussian elimination over bit sets costs O(E^3 / w) with machine-word width w. Storing paths, candidates, and basis vectors takes O(V E + E^2 / w) space.",
        uses: [
            "Analyzing chemical and electrical networks through fundamental cycles",
            "Cycle basis reduction in graph drawing and constraint solving",
            "Detecting near-minimal loops in infrastructure networks",
        ],
        references: [
            "Horton, A Polynomial-Time Algorithm to Find the Shortest Cycle Basis, 1987",
            "Kavitha et al., Cycle Bases in Graphs: A Survey, 2009",
        ],
        workedExample:
            "For a square with one diagonal, the three shortest candidate cycles are the two triangles and the outer square. Greedy acceptance keeps the two triangles (total weight six), from which the square is recovered as their symmetric difference, giving a minimum basis of size two.",
    },
    id: "minimum-cycle-basis-horton",
    name: "Horton Minimum Cycle Basis",
    category: "graph",
    complexity: { time: "O(V E + E^3 / w)", space: "O(E^2 / w)" },
    defaultInput: {
        vertices: [0, 1, 2, 3, 4, 5],
        edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3], [0, 3]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with the graph and an empty cycle basis",
        "for every source, find shortest paths to all vertices",
        "for every edge, combine the two source paths into a candidate cycle",
        "sort all candidate cycles by total weight",
        "for each candidate in order, test GF(2) independence",
        "if independent, add it to the basis and keep its edges",
        "stop when the cycle-space dimension is reached",
        "done: report the minimum total-weight basis",
    ],
};

export default module;
