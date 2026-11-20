/**
 * linear-threshold-model.ts - Linear Threshold Influence Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The linear threshold model describes how influence spreads through a
 * network. Each vertex has a threshold, and each edge carries the fraction of
 * influence its source passes to its target. An inactive vertex becomes
 * active once the total weighted influence from its active neighbors reaches
 * its threshold. Activations repeat in synchronized rounds until no more
 * vertices qualify.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * m) for k rounds over m directed edges
 *   Space: O(V + E) for the active set, thresholds and adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Active vertices are green (sorted).
 *   - Newly activated vertices are orange (comparing).
 *   - Edges carrying influence in the current round are blue (path).
 *   - Inactive vertices remain gray (unvisited).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "./graph-util";

interface ThresholdTask {
    graph?: Record<string, Array<[string, number]>>;
    active?: string[];
    threshold?: Record<string, number>;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ThresholdTask | null) ?? {};
    const adjacency: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 0.6],
            ["C", 0.4],
        ],
        B: [
            ["A", 0.5],
            ["D", 0.7],
        ],
        C: [
            ["A", 0.3],
            ["D", 0.5],
        ],
        D: [
            ["B", 0.2],
            ["C", 0.4],
        ],
    };
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat().map(([to]) => to)])];
    const nodes: VisualEntity[] = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges: VisualEdge[] = makeWeightedEdges(adjacency);
    for (const edge of edges) edge.directed = true;

    const thresholds = new Map<string, number>();
    for (const label of labels) {
        const supplied = task.threshold?.[label];
        thresholds.set(label, typeof supplied === "number" ? supplied : 0.5);
    }
    const active = new Set<string>(Array.isArray(task.active) ? (task.active as string[]) : ["A"]);
    for (const label of active) {
        if (!labels.includes(label)) active.delete(label);
    }

    let step = 0;
    const emit = (
        activeNow: Set<string>,
        newlyActive: Set<string>,
        usedEdges: Set<string>,
        description: string,
        codeLineNumber: number,
        extra: VisualFrame["meta"] = {},
    ): VisualFrame => {
        for (const node of nodes) {
            const label = String(node.metadata.label);
            node.state = activeNow.has(label) ? "sorted" : newlyActive.has(label) ? "comparing" : "unvisited";
        }
        for (const edge of edges) edge.state = usedEdges.has(edge.id) ? "path" : "idle";
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                steps: 0,
                activeCount: activeNow.size,
                activeNodes: [...activeNow].sort(),
                newActivated: [...newlyActive].sort(),
                vertices: labels.length,
                ...extra,
            },
        };
    };

    yield emit(active, new Set(), new Set(), `Linear threshold diffusion starts with ${active.size} active vertex(es).`, 0);
    step += 1;

    let rounds = 0;
    while (rounds < labels.length + 1) {
        const influenced = new Map<string, number>();
        const usedEdges = new Set<string>();
        for (const [source, targets] of Object.entries(adjacency)) {
            if (!active.has(source)) continue;
            for (const [target, weight] of targets) {
                influenced.set(target, (influenced.get(target) ?? 0) + weight);
                usedEdges.add(`edge-${source}-${target}`);
            }
        }

        const newly = new Set<string>();
        const details: string[] = [];
        for (const label of labels) {
            if (active.has(label)) continue;
            const value = influenced.get(label) ?? 0;
            const limit = thresholds.get(label) ?? 0.5;
            if (value + 1e-12 >= limit) {
                newly.add(label);
            }
            details.push(`${label}: ${value.toFixed(2)}/${limit.toFixed(2)}`);
        }

        yield emit(
            active,
            newly,
            usedEdges,
            `Round ${rounds + 1}: influence totals ${details.join(", ")}.`,
            1,
            { steps: rounds + 1 },
        );
        step += 1;

        if (newly.size === 0) break;
        for (const label of newly) active.add(label);
        rounds += 1;
        yield emit(
            active,
            newly,
            usedEdges,
            `Round ${rounds}: ${[...newly].join(", ")} became active.`,
            2,
            { steps: rounds },
        );
        step += 1;
    }

    yield emit(
        active,
        new Set(),
        new Set(),
        `Diffusion settled with ${active.size} active vertex(es) after ${rounds} round(s).`,
        4,
        { steps: rounds, activeNodes: [...active].sort() },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of each person in a network as adopting an idea when enough of their neighbors have adopted it. The linear threshold model adds up the weighted influence from active neighbors and compares that sum to the person's personal threshold. Activations happen in rounds, and once a person is active they keep influencing others forever.",
        invariants: [
            "The active set only grows; no vertex ever becomes inactive again.",
            "A vertex activates only when the sum of incoming weights from active neighbors reaches its threshold.",
            "The process stops after at most one round per vertex.",
        ],
        correctness:
            "Each round computes exactly the qualification condition for every inactive vertex using the current active set, and activates all qualifying vertices simultaneously. Because the active set is monotone and bounded by the number of vertices, the iteration reaches a fixed point; that fixed point is the unique smallest set closed under the threshold rule containing the seeds.",
        complexityRationale:
            "A round scans every directed edge once to accumulate influence and every vertex once to test its threshold, so it costs O(V + E). At most V rounds can add a new vertex, giving O(V(V + E)) time and O(V + E) space.",
        uses: [
            "Modeling adoption of products and ideas in social networks",
            "Choosing influential seeds for viral marketing campaigns",
            "Studying cascade failure in interdependent infrastructure",
        ],
        references: [
            "Granovetter, Threshold Models of Collective Behavior, 1978",
            "Kempe, Kleinberg and Tardos, Maximizing the Spread of Influence, 2003",
        ],
        workedExample:
            "With seed A and thresholds B=0.5, C=0.6, D=0.7, A sends 0.6 to B and 0.4 to C. In round one B crosses its threshold; C does not. In round two B sends 0.7 to D, so D activates. C remains short of 0.6 and stays inactive.",
    },
    id: "linear-threshold-model",
    name: "Linear Threshold Model",
    category: "graph",
    complexity: { time: "O(V(V + E))", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 0.6],
                ["C", 0.4],
            ],
            B: [
                ["A", 0.5],
                ["D", 0.7],
            ],
            C: [
                ["A", 0.3],
                ["D", 0.5],
            ],
            D: [
                ["B", 0.2],
                ["C", 0.4],
            ],
        },
        active: ["A"],
        threshold: { A: 0, B: 0.5, C: 0.6, D: 0.7 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from the seed set of active vertices",
        "sum incoming weighted influence for every inactive vertex",
        "activate any vertex whose sum reaches its threshold",
        "apply all activations of the round simultaneously",
        "repeat while at least one vertex activated",
        "report the settled active set",
        "done: diffusion has reached a fixed point",
    ],
};

export default module;
