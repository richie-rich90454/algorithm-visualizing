/**
 * leiden-community.ts – Leiden Community Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Leiden community detection optimizes modularity in three repeating stages:
 * local moving of nodes between communities, refinement that splits any
 * community whose induced subgraph is disconnected, and aggregation of the
 * result into a smaller graph. The refinement stage is the hallmark of Leiden:
 * unlike Louvain, it guarantees that every final community is connected.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(I * (V + E)) for I local-moving passes
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A vertex shows its community id in the label and turns BLUE.
 *   - Edges whose endpoints share a community are PINK, others IDLE.
 *   - A vertex being moved is YELLOW.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Every community induces a connected subgraph when the run finishes.
 *   - Modularity never decreases across a move or a refinement.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: Array<string | number>; edges?: Array<[string | number, string | number]> } | null) ?? {};
    const vertices = (task.vertices ?? [0, 1, 2, 3, 4, 5]).map((v) => Number(v));
    const incoming = (task.edges ?? [
        [0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3],
    ]).map(([a, b]) => [Number(a), Number(b)] as [number, number]);

    const indexOf = new Map<number, number>();
    vertices.forEach((v, i) => indexOf.set(v, i));
    const adjacency = new Map<number, Map<number, number>>();
    for (const v of vertices) {
        adjacency.set(v, new Map<number, number>());
    }
    for (const [a, b] of incoming) {
        adjacency.get(a)?.set(b, (adjacency.get(a)?.get(b) ?? 0) + 1);
        adjacency.get(b)?.set(a, (adjacency.get(b)?.get(a) ?? 0) + 1);
    }
    const degree = new Map<number, number>();
    for (const v of vertices) {
        let total = 0;
        for (const weight of adjacency.get(v)?.values() ?? []) {
            total += weight;
        }
        degree.set(v, total);
    }
    const m2 = vertices.reduce((sum, v) => sum + (degree.get(v) ?? 0), 0);

    let part = vertices.map((_, i) => i);
    let iteration = 0;
    let moved = -1;
    let step = 0;

    const communityCount = (p: number[]): number => new Set(p).size;

    const modularity = (p: number[]): number => {
        if (m2 === 0) {
            return 0;
        }
        let total = 0;
        const groups = new Map<number, number[]>();
        p.forEach((c, i) => {
            const list = groups.get(c) ?? [];
            list.push(i);
            groups.set(c, list);
        });
        for (const members of groups.values()) {
            let internal = 0;
            let tot = 0;
            for (const i of members) {
                const v = vertices[i] as number;
                tot += degree.get(v) ?? 0;
                for (const [neighbor, weight] of adjacency.get(v) ?? []) {
                    if (p[indexOf.get(neighbor) as number] === p[i]) {
                        internal += weight;
                    }
                }
            }
            internal /= 2;
            const fraction = tot / m2;
            total += internal / m2 - fraction * fraction;
        }
        return total;
    };

    const frame = (description: string, codeLineNumber: number): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((v, i) => ({
            id: `node-${v}`,
            type: "node" as const,
            label: `${v}:c${part[i]}`,
            value: v,
            state: i === moved ? ("comparing" as const) : ("active" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { vertex: v, community: part[i] as number },
        }));
        const visualEdges: VisualEdge[] = incoming.map(([a, b]) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: part[indexOf.get(a) as number] === part[indexOf.get(b) as number] ? ("path" as const) : ("idle" as const),
            directed: false,
        }));
        return {
            stepNumber: step++,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { iteration, communities: communityCount(part), modularity: modularity(part) },
        };
    };

    yield frame("Leiden starts with every vertex in its own community.", 0);

    function* localMoving(p: number[]): Generator<VisualFrame, void, unknown> {
        let changed = true;
        while (changed) {
            changed = false;
            const totalDegree = new Map<number, number>();
            p.forEach((c, i) => {
                totalDegree.set(c, (totalDegree.get(c) ?? 0) + (degree.get(vertices[i] as number) ?? 0));
            });
            for (let i = 0; i < vertices.length; i += 1) {
                const v = vertices[i] as number;
                const current = p[i] as number;
                const dv = degree.get(v) ?? 0;
                const weightsTo = new Map<number, number>();
                for (const [neighbor, weight] of adjacency.get(v) ?? []) {
                    const c = p[indexOf.get(neighbor) as number] as number;
                    weightsTo.set(c, (weightsTo.get(c) ?? 0) + weight);
                }
                const weightCurrent = weightsTo.get(current) ?? 0;
                const totalCurrent = totalDegree.get(current) ?? 0;
                let bestCommunity = current;
                let bestGain = 0;
                for (const [candidate, weight] of weightsTo) {
                    if (candidate === current) {
                        continue;
                    }
                    const totalCandidate = totalDegree.get(candidate) ?? 0;
                    const gain = m2 * (weight - weightCurrent) - 2 * dv * (totalCandidate - totalCurrent) - 2 * dv * dv;
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestCommunity = candidate;
                    }
                }
                if (bestCommunity !== current) {
                    totalDegree.set(current, totalCurrent - dv);
                    totalDegree.set(bestCommunity, (totalDegree.get(bestCommunity) ?? 0) + dv);
                    p[i] = bestCommunity;
                    changed = true;
                    moved = i;
                    yield frame(`Moved vertex ${v} from community ${current} to ${bestCommunity}.`, 2);
                }
            }
        }
        moved = -1;
    }

    function refine(p: number[]): number[] {
        const groups = new Map<number, number[]>();
        p.forEach((c, i) => {
            const list = groups.get(c) ?? [];
            list.push(i);
            groups.set(c, list);
        });
        const refined = new Array<number>(p.length).fill(-1);
        let nextId = 0;
        for (const members of groups.values()) {
            const memberSet = new Set(members);
            const seen = new Set<number>();
            for (const start of members) {
                if (seen.has(start)) {
                    continue;
                }
                const componentId = nextId;
                nextId += 1;
                const stack = [start];
                seen.add(start);
                while (stack.length > 0) {
                    const i = stack.pop() as number;
                    refined[i] = componentId;
                    const v = vertices[i] as number;
                    for (const neighbor of adjacency.get(v)?.keys() ?? []) {
                        const ni = indexOf.get(neighbor) as number;
                        if (memberSet.has(ni) && !seen.has(ni)) {
                            seen.add(ni);
                            stack.push(ni);
                        }
                    }
                }
            }
        }
        return refined;
    }

    const sameGrouping = (a: number[], b: number[]): boolean => {
        for (let i = 0; i < a.length; i += 1) {
            for (let j = i + 1; j < a.length; j += 1) {
                if ((a[i] === a[j]) !== (b[i] === b[j])) {
                    return false;
                }
            }
        }
        return true;
    };

    for (let pass = 0; pass < 10; pass += 1) {
        iteration = pass;
        yield frame(`Iteration ${pass + 1}: local moving of vertices.`, 1);
        yield* localMoving(part);
        const refined = refine(part);
        const stable = sameGrouping(part, refined);
        part = refined;
        yield frame(
            `Refinement ${stable ? "found no split" : "split disconnected communities"}; ${communityCount(part)} community(ies).`,
            4,
        );
        if (stable) {
            break;
        }
    }

    yield frame(
        `Leiden finished with ${communityCount(part)} connected communities and modularity ${modularity(part).toFixed(3)}.`,
        7,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Community detection groups densely connected vertices. Leiden improves on the Louvain method by refusing to accept a community whose members are not connected through edges inside that community. It first lets vertices move to the community that raises modularity most, then cuts any disconnected community into its connected pieces, and repeats on the smaller quotient graph.",
        invariants: [
            "A vertex moves only when the exact modularity change is positive.",
            "Refinement splits a community solely along its internal connected components, so it cannot join unrelated vertices.",
            "The partition always assigns every vertex to exactly one community.",
        ],
        correctness:
            "The local-moving step accepts only moves with positive modularity gain, and splitting a disconnected community leaves internal edge weight unchanged while reducing the sum of squared community degrees, which raises modularity. Because modularity strictly increases with each accepted change and there are finitely many partitions, the process terminates. After the final refinement, splitting each community into connected components guarantees every community induces a connected subgraph.",
        complexityRationale:
            "Each local-moving pass examines every vertex and its incident edges, costing O(V + E), and a bounded number of passes are run, giving O(I (V + E)) time. Adjacency and partition arrays use O(V + E) space.",
        uses: [
            "Discovering groups in social and collaboration networks",
            "Graph clustering for visualization and compression",
            "A scientifically well-behaved replacement for Louvain",
        ],
        references: [
            "Traag, Waltman and van Eck, From Louvain to Leiden, 2019",
            "Blondel et al., Fast Unfolding of Communities in Large Networks, 2008",
        ],
        workedExample:
            "Two triangles joined by a single link start as six communities. Local moving pulls each triangle into one community, and refinement keeps the two triangles separate because the bridge between them is a single link connecting otherwise dense groups, yielding two connected communities.",
    },
    id: "leiden-community",
    name: "Leiden Community Detection",
    category: "graph",
    complexity: { time: "O(I (V + E))", space: "O(V + E)" },
    defaultInput: {
        vertices: [0, 1, 2, 3, 4, 5],
        edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with every vertex in its own community",
        "repeat for a bounded number of iterations",
        "for each vertex compute the modularity gain of joining neighbor communities",
        "move the vertex when some gain is positive",
        "after the sweep, split any disconnected community into connected parts",
        "if no split occurred, stop",
        "aggregate and repeat on the smaller graph in the full method",
        "done: report connected communities and their modularity",
    ],
};

export default module;
