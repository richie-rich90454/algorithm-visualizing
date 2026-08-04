/**
 * cost-scaling.ts – Cost Scaling Algorithm (Min-Cost Max-Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Cost scaling is a *polynomial* alternative to the successive-shortest-paths
 * min-cost max-flow algorithm. Instead of sending one augmenting path at a
 * time, it works in phases indexed by a scaling factor ε. In each phase it
 * brings the flow "closer to optimal" with respect to ε by adjusting reduced
 * costs, and halves ε until ε < 1, at which point the flow is optimal.
 *
 * This educational implementation captures the phase-based ε scaling idea:
 * each phase re-runs successive cheapest paths, but only along edges whose
 * reduced cost is small relative to ε, and ε shrinks by half each phase.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·E·log C) with appropriate data structures (C = largest cost)
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current scaling factor ε is announced each phase.
 *   - The edges usable under the current ε are highlighted.
 *   - The accumulated flow and cost update each phase.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Demonstrates the "scaling" algorithmic technique (like capacity scaling
 *     in max flow).
 *   - The ε-doubling/halving loop is a recurring pattern in approximation and
 *     optimization algorithms.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

/**
 * The Cost Scaling generator.
 *
 * @param input `{ edges, vertices, source, sink }` with `[from, to, cap, cost]`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            edges?: Array<[string, string, number, number]>;
            vertices?: string[];
            source?: string;
            sink?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["S", "A", "B", "T"];
    const edgeList: Array<[string, string, number, number]> = task.edges ?? [
        ["S", "A", 3, 2],
        ["S", "B", 2, 1],
        ["A", "B", 1, 1],
        ["A", "T", 2, 3],
        ["B", "T", 3, 2],
    ];
    const source = task.source ?? "S";
    const sink = task.sink ?? "T";

    const nodes = makeFlowNodes(vertices);
    const edges = makeFlowEdges(edgeList.map(([a, b, c]) => [a, b, c]));

    const cap = new Map<string, number>();
    const cost = new Map<string, number>();
    for (const [u, v, capacity, c] of edgeList) {
        cap.set(`${u}→${v}`, capacity);
        cost.set(`${u}→${v}`, c);
        if (!cap.has(`${v}→${u}`)) {
            cap.set(`${v}→${u}`, 0);
            cost.set(`${v}→${u}`, -c);
        }
    }

    const neighbourMap = new Map<string, string[]>();
    for (const [u, v] of edgeList) {
        const listU = neighbourMap.get(u) ?? [];
        listU.push(v);
        neighbourMap.set(u, listU);
        const listV = neighbourMap.get(v) ?? [];
        listV.push(u);
        neighbourMap.set(v, listV);
    }

    const flow = new Map<string, number>();
    for (const [u, v] of edgeList) {
        flow.set(`${u}→${v}`, 0);
    }

    let step = 0;
    let totalFlow = 0;
    let totalCost = 0;
    let phase = 0;

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Cost scaling – phases with a shrinking scaling factor ε.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { flow: 0, cost: 0 },
    };
    step += 1;

    const refreshLabels = (): void => {
        edgeList.forEach(([u, v, capacity, c], index) => {
            const edge = edges[index];
            if (edge) {
                edge.label = `${flow.get(`${u}→${v}`) ?? 0}/${capacity} (${c})`;
            }
        });
    };

    // Start ε at the largest edge cost, halving each phase.
    let eps = Math.max(...edgeList.map((e) => Math.abs(e[3] ?? 0)), 1);

    while (eps >= 1) {
        phase += 1;

        // Highlight edges whose reduced cost is within the ε budget.
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [u, v] of edgeList) {
            const edge = edges.find(
                (e) => e.sourceId === `node-${u}` && e.targetId === `node-${v}`,
            );
            if (edge && Math.abs(cost.get(`${u}→${v}`) ?? 0) <= eps) {
                edge.state = "highlight";
            }
        }

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Phase ${phase}: scaling factor ε = ${eps}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { flow: totalFlow, cost: totalCost, eps },
        };
        step += 1;

        // ------------------------------------------------------------------
        // Within this phase, keep pushing along cheapest residual paths whose
        // edge costs are at most ε. (Successive-shortest-paths sub-step.)
        // ------------------------------------------------------------------
        for (;;) {
            // Bellman-Ford for the cheapest residual path.
            const dist = new Map<string, number>();
            const parent = new Map<string, string | null>();
            for (const v of vertices) {
                dist.set(v, Infinity);
                parent.set(v, null);
            }
            dist.set(source, 0);

            for (let round = 0; round < vertices.length - 1; round += 1) {
                for (const u of vertices) {
                    const du = dist.get(u) ?? Infinity;
                    if (du === Infinity) {
                        continue;
                    }
                    for (const v of neighbourMap.get(u) ?? []) {
                        const edgeCost = cost.get(`${u}→${v}`) ?? 0;
                        if ((cap.get(`${u}→${v}`) ?? 0) > 0 && edgeCost <= eps) {
                            const alt = du + edgeCost;
                            if (alt < (dist.get(v) ?? Infinity)) {
                                dist.set(v, alt);
                                parent.set(v, u);
                            }
                        }
                    }
                }
            }

            if (dist.get(sink) === Infinity) {
                break; // No ε-cheap path left – end this phase.
            }

            const path: string[] = [];
            let cursor: string | null = sink;
            while (cursor !== null) {
                path.push(cursor);
                cursor = parent.get(cursor) ?? null;
            }
            path.reverse();

            let bottleneck = Infinity;
            for (let i = 0; i < path.length - 1; i += 1) {
                bottleneck = Math.min(bottleneck, cap.get(`${path[i]}→${path[i + 1]}`) ?? 0);
            }

            for (let i = 0; i < path.length - 1; i += 1) {
                const u = path[i] as string;
                const v = path[i + 1] as string;
                const edgeCost = cost.get(`${u}→${v}`) ?? 0;
                cap.set(`${u}→${v}`, (cap.get(`${u}→${v}`) ?? 0) - bottleneck);
                cap.set(`${v}→${u}`, (cap.get(`${v}→${u}`) ?? 0) + bottleneck);
                if (flow.has(`${u}→${v}`)) {
                    flow.set(`${u}→${v}`, (flow.get(`${u}→${v}`) ?? 0) + bottleneck);
                }
                if (flow.has(`${v}→${u}`)) {
                    flow.set(`${v}→${u}`, Math.max(0, (flow.get(`${v}→${u}`) ?? 0) - bottleneck));
                }
                totalCost += edgeCost * bottleneck;
            }
            totalFlow += bottleneck;
            refreshLabels();

            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `Phase ${phase}: pushed ${bottleneck} along ${path.join(" → ")} – flow ${totalFlow}, cost ${totalCost}.`,
                codeLineNumber: 3,
                layout: "graph",
                meta: { flow: totalFlow, cost: totalCost, eps },
            };
            step += 1;
        }

        eps = Math.floor(eps / 2);
    }

    // Saturate-color edges.
    for (const edge of edges) {
        edge.state = "idle";
    }
    for (let i = 0; i < edgeList.length; i += 1) {
        const [u, v, capacity] = edgeList[i] ?? [];
        if (!u || !v) {
            continue;
        }
        if ((flow.get(`${u}→${v}`) ?? 0) >= capacity) {
            const edge = edges[i];
            if (edge) {
                edge.state = "path";
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Cost scaling complete after ${phase} phase(s): ${totalFlow} units at cost ${totalCost}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { flow: totalFlow, cost: totalCost, phases: phase },
    };
}

/** The Cost Scaling module, registered with the engine. */
const module: AlgorithmModule = {
    id: "cost-scaling",
    name: "Cost Scaling",
    category: "flow",
    complexity: { time: "O(V·E·log C)", space: "O(V + E)" },
    // Same instance as Min-Cost Max-Flow for a direct comparison.
    defaultInput: {
        edges: [
            ["S", "A", 3, 2],
            ["S", "B", 2, 1],
            ["A", "B", 1, 1],
            ["A", "T", 2, 3],
            ["B", "T", 3, 2],
        ],
        vertices: ["S", "A", "B", "T"],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
};

export default module;
