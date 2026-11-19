/**
 * cnm-community-detection.ts - Clauset-Newman-Moore Community Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The CNM method is a greedy agglomerative search for communities. Every
 * vertex starts in its own community, and at each step the pair of communities
 * whose merger increases modularity the most is joined. It stops when no
 * merger can increase modularity. Modularity rewards internal edges beyond
 * the number expected from the degree distribution.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * depth) with an incremental gain matrix; O(V^3) naive
 *   Space: O(V^2) for the community gain matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two communities being merged are orange (comparing).
 *   - Edges crossing the merge are yellow (highlight).
 *   - Final communities each receive a distinct state color.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface CommunityTask {
    graph?: Record<string, string[]>;
}

function normalize(adjacency: Record<string, string[]>): { labels: string[]; edges: Array<[string, string]> } {
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const seen = new Set<string>();
    const edges: Array<[string, string]> = [];
    for (const [source, targets] of Object.entries(adjacency)) {
        for (const target of targets) {
            const a = source < target ? source : target;
            const b = source < target ? target : source;
            const key = `${a}|${b}`;
            if (a !== b && !seen.has(key)) {
                seen.add(key);
                edges.push([a, b]);
            }
        }
    }
    return { labels, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CommunityTask | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["C", "E", "F"],
        E: ["D", "F"],
        F: ["D", "E"],
    };
    const { labels, edges } = normalize(adjacency);
    const m = edges.length;
    const degree = new Map<string, number>(labels.map((v) => [v, 0]));
    for (const [a, b] of edges) {
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
    }

    const nodes: VisualEntity[] = labels.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label, community: label },
    }));
    const visualEdges: VisualEdge[] = edges.map(([a, b]) => {
        const first = a < b ? a : b;
        const second = a < b ? b : a;
        return {
            id: `edge-${first}-${second}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "idle" as const,
            directed: false,
        };
    });

    const community = new Map<string, string>(labels.map((v) => [v, v]));
    const modularity = (): number => {
        if (m === 0) return 0;
        let total = 0;
        for (const [a, b] of edges) {
            if (community.get(a) === community.get(b)) total += 1;
        }
        const sums = new Map<string, number>();
        for (const vertex of labels) {
            const group = community.get(vertex) as string;
            sums.set(group, (sums.get(group) ?? 0) + (degree.get(vertex) ?? 0));
        }
        let penalty = 0;
        for (const value of sums.values()) penalty += (value / (2 * m)) ** 2;
        return total / m - penalty;
    };

    let step = 0;
    const updateEntities = (states: Map<string, EntityState>, edgeStates: Map<string, EntityState>): void => {
        for (const node of nodes) {
            node.state = states.get(String(node.metadata.label)) ?? "unvisited";
            node.metadata.community = community.get(String(node.metadata.label)) as string;
        }
        for (const edge of visualEdges) {
            edge.state = edgeStates.get(edge.id) ?? "idle";
        }
    };
    const emit = (description: string, codeLineNumber: number, states: Map<string, EntityState>, edgeStates: Map<string, EntityState>, extra: VisualFrame["meta"] = {}): VisualFrame => {
        updateEntities(states, edgeStates);
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node, metadata: { ...node.metadata } })),
            edges: visualEdges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: { communities: new Set(community.values()).size, modularity: Math.round(modularity() * 1000) / 1000, edges: m, ...extra },
        };
    };

    yield emit(
        `CNM starts with ${labels.length} singleton communities and Q=${modularity().toFixed(3)}.`,
        0,
        new Map(),
        new Map(),
    );
    step += 1;

    let merges = 0;
    const palette: EntityState[] = ["sorted", "visited", "highlight", "path"];
    if (m > 0) {
        for (let iteration = 0; iteration < labels.length - 1; iteration += 1) {
            const current = modularity();
            const groups = [...new Set(community.values())];
            let best: [string, string] | null = null;
            let bestGain = 1e-12;
            for (let i = 0; i < groups.length; i += 1) {
                for (let j = i + 1; j < groups.length; j += 1) {
                    const ci = groups[i] as string;
                    const cj = groups[j] as string;
                    const savedI = new Map<string, string>();
                    for (const [node, c] of community) {
                        if (c === cj) savedI.set(node, ci);
                    }
                    for (const [node, c] of savedI) community.set(node, c);
                    const gain = modularity() - current;
                    for (const [node, c] of savedI) community.set(node, cj);
                    if (gain > bestGain) {
                        bestGain = gain;
                        best = [ci, cj];
                    }
                }
            }
            if (!best) break;
            const [ci, cj] = best;
            const crossing = new Map<string, EntityState>();
            for (const edge of visualEdges) {
                const a = String(edge.sourceId).slice(5);
                const b = String(edge.targetId).slice(5);
                const ca = community.get(a);
                const cb = community.get(b);
                if ((ca === ci && cb === cj) || (ca === cj && cb === ci)) crossing.set(edge.id, "highlight");
            }
            const states = new Map<string, EntityState>();
            for (const [node, c] of community) {
                if (c === ci || c === cj) states.set(node, "comparing");
            }
            yield emit(
                `Best merge: communities ${ci} and ${cj} raise Q by ${bestGain.toFixed(3)}.`,
                1,
                states,
                crossing,
                { gain: Math.round(bestGain * 1000) / 1000 },
            );
            step += 1;

            for (const [node, c] of [...community]) {
                if (c === cj) community.set(node, ci);
            }
            merges += 1;
            yield emit(`Merged ${ci} and ${cj}; Q is now ${modularity().toFixed(3)}.`, 2, new Map(), new Map(), { merges });
            step += 1;
        }
    }

    const finalGroups = new Map<string, string[]>();
    for (const [node, c] of community) {
        if (!finalGroups.has(c)) finalGroups.set(c, []);
        (finalGroups.get(c) as string[]).push(node);
    }
    const finalStates = new Map<string, EntityState>();
    let paletteIndex = 0;
    for (const members of finalGroups.values()) {
        const color = palette[paletteIndex % palette.length] as EntityState;
        for (const member of members) finalStates.set(member, color);
        paletteIndex += 1;
    }
    yield emit(
        `Stopped after ${merges} merge(s): ${[...finalGroups.values()].map((v) => `{${v.slice().sort().join(",")}}`).join(" ")} at Q=${modularity().toFixed(3)}.`,
        4,
        finalStates,
        new Map(),
        { merges, communities: finalGroups.size },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Modularity asks whether a group has more internal edges than a random graph with the same degrees would give it. CNM starts with every vertex alone and repeatedly joins the two communities whose merger improves modularity the most. It stops as soon as no merger helps, which leaves a partition of dense groups.",
        invariants: [
            "Every vertex belongs to exactly one community.",
            "Each accepted merge strictly increases modularity.",
            "Merging only combines existing communities; it never splits one.",
        ],
        correctness:
            "Modularity is bounded above, so a strictly increasing sequence of merges must terminate. At termination no pair has positive gain, which is exactly the local optimum the greedy method seeks. The incremental gain matrix computes the same change in modularity as recomputing the objective, so the chosen merges are the correct greedy moves.",
        complexityRationale:
            "With an incremental gain matrix each of the O(V) merges updates O(V) entries, giving O(m + V^2) typical work; the naive variant recomputes all pairs and costs O(V^3). Storing the matrix and the communities uses O(V^2) space.",
        uses: [
            "Finding groups in social and citation networks",
            "Segmenting biological interaction networks",
            "A fast modularity baseline before Louvain refinement",
        ],
        references: [
            "Clauset, Newman and Moore, Finding community structure in very large networks, 2004",
            "Newman and Girvan, Finding and evaluating community structure in networks, 2004",
        ],
        workedExample:
            "On a six-vertex barbell with a single bridge edge C-D, singleton communities merge inside {A,B,C} and inside {D,E,F}. Crossing the bridge lowers modularity, so the process stops with those two communities at high Q.",
    },
    id: "cnm-community-detection",
    name: "CNM Community Detection",
    category: "graph",
    complexity: { time: "O(V^2)", space: "O(V^2)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["C", "E", "F"],
            E: ["D", "F"],
            F: ["D", "E"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with every vertex in its own community",
        "compute the modularity gain for every pair of communities",
        "choose the pair with the largest positive gain",
        "if no gain is positive, stop",
        "merge the chosen pair and update the gain matrix",
        "repeat until communities can no longer improve",
        "done: report the final community partition",
    ],
};

export default module;
