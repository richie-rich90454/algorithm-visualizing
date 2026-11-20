/**
 * highest-label-push-relabel.ts - Highest-Label Push-Relabel (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is the Goldberg-Tarjan selection rule for push-relabel: among all
 * active vertices (those holding excess flow), always discharge the one with
 * the largest height label first. Discharging a high vertex pushes flow
 * toward the sink in long steps instead of scattering it among low vertices.
 * A gap heuristic raises every label above an emptied height level, which
 * removes futile vertices in one sweep.
 *
 * Like all push-relabel methods, it never searches for a full augmenting
 * path. It saturates the source edges into a preflow, then repeatedly pushes
 * along admissible arcs (height drops by one) and relabels when stuck.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2 * sqrt(E)) with the highest-label rule and gap heuristic
 *   Space: O(V + E) for the residual arcs, heights, and excess values
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The active vertex being discharged is YELLOW (comparing).
 *   - The arc carrying a push is CYAN (path).
 *   - Vertex labels show height and excess; the final meta reports max flow.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowNodes } from "./flow-util";

type Arc = { from: number; to: number; cap: number; original: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            vertices?: string[];
            edges?: Array<[string, string, number]>;
            source?: string;
            sink?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["S", "A", "B", "T"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["S", "A", 3],
        ["S", "B", 2],
        ["A", "B", 1],
        ["A", "T", 2],
        ["B", "T", 3],
    ];
    const sourceLabel = task.source ?? "S";
    const sinkLabel = task.sink ?? "T";
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const source = index.get(sourceLabel) ?? 0;
    const sink = index.get(sinkLabel) ?? vertices.length - 1;
    const n = vertices.length;

    const arcs: Arc[] = [];
    const adj: number[][] = vertices.map(() => []);
    for (const [u, v, rawCap] of edgeList) {
        const from = index.get(u);
        const to = index.get(v);
        if (from === undefined || to === undefined) {
            continue;
        }
        const capacity = Math.max(0, Math.floor(rawCap));
        adj[from].push(arcs.length);
        arcs.push({ from, to, cap: capacity, original: capacity });
        adj[to].push(arcs.length);
        arcs.push({ from: to, to: from, cap: 0, original: 0 });
    }

    const height = new Array<number>(n).fill(0);
    const excess = new Array<number>(n).fill(0);
    const currentArc = new Array<number>(n).fill(0);
    const nodes = makeFlowNodes(vertices);
    const flowPerOriginal = new Array<number>(edgeList.length).fill(0);
    let step = 0;

    const emit = (
        active: number,
        pushedArc: number,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): void => {
        const edges: VisualEdge[] = edgeList.map(([u, v], i) => ({
            id: `edge-${i}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: `${flowPerOriginal[i] ?? 0}/${arcs[i * 2]?.original ?? 0}`,
            state: pushedArc === i ? ("path" as const) : ("idle" as const),
            directed: true,
        }));
        frames.push({
            stepNumber: step++,
            entities: nodes.map((node, i) => ({
                ...node,
                label: `${vertices[i]} (h=${height[i]}, e=${excess[i]})`,
                state: i === active ? ("comparing" as const) : ("unvisited" as const),
            })),
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { flow: Math.max(0, excess[sink] ?? 0), vertices: n, edges: edgeList.length, ...extra },
        });
    };

    const frames: VisualFrame[] = [];

    if (source === sink) {
        emit(-1, -1, "Source and sink are the same vertex; flow is zero.", 0, { maxFlow: 0 });
        yield* frames;
        return;
    }

    emit(-1, -1, `Highest-label push-relabel on ${n} vertices.`, 0);

    // Preflow: saturate every arc leaving the source.
    height[source] = n;
    for (const [u, v, rawCap] of edgeList) {
        if (u !== sourceLabel) {
            continue;
        }
        const from = index.get(u);
        const to = index.get(v);
        if (from === undefined || to === undefined) {
            continue;
        }
        const arcIndex = adj[from]?.find((e) => arcs[e]?.to === to && (arcs[e]?.cap ?? 0) > 0);
        if (arcIndex === undefined) {
            continue;
        }
        const arc = arcs[arcIndex];
        if (!arc) {
            continue;
        }
        const amount = arc.cap;
        arc.cap = 0;
        const reverse = arcs[arcIndex ^ 1];
        if (reverse) {
            reverse.cap += amount;
        }
        excess[from] = (excess[from] ?? 0) - amount;
        excess[to] = (excess[to] ?? 0) + amount;
        const original = Math.floor(arcIndex / 2);
        flowPerOriginal[original] = amount;
    }
    emit(-1, -1, "Saturated all source arcs to build the initial preflow.", 1);

    const recount = (): number[] => {
        const counts = new Array<number>(2 * n + 2).fill(0);
        for (const h of height) {
            const bucket = Math.min(h, 2 * n + 1);
            counts[bucket] = (counts[bucket] ?? 0) + 1;
        }
        return counts;
    };
    let counts = recount();
    let pushes = 0;
    let relabels = 0;
    let gaps = 0;
    let operations = 0;

    /** Discharge one active vertex; return true when its excess is cleared. */
    const discharge = (u: number): boolean => {
        while ((excess[u] ?? 0) > 0) {
            operations += 1;
            if (operations > 200000) {
                return false;
            }
            let pushed = false;
            const list = adj[u] ?? [];
            for (let i = currentArc[u] ?? 0; i < list.length; i += 1) {
                currentArc[u] = i;
                const arcIndex = list[i] as number;
                const arc = arcs[arcIndex];
                if (!arc || arc.cap <= 0 || (height[arc.to] ?? 0) !== (height[u] ?? 0) - 1) {
                    continue;
                }
                const amount = Math.min(excess[u] ?? 0, arc.cap);
                arc.cap -= amount;
                const reverse = arcs[arcIndex ^ 1];
                if (reverse) {
                    reverse.cap += amount;
                }
                excess[u] = (excess[u] ?? 0) - amount;
                excess[arc.to] = (excess[arc.to] ?? 0) + amount;
                const original = Math.floor(arcIndex / 2);
                flowPerOriginal[original] = (flowPerOriginal[original] ?? 0) + amount;
                pushes += 1;
                emit(
                    u,
                    original,
                    `Pushed ${amount} from ${vertices[u]} to ${vertices[arc.to]} along an admissible arc.`,
                    3,
                    { pushes, relabels, gaps },
                );
                pushed = true;
                break;
            }
            if (pushed) {
                continue;
            }

            let minNeighborHeight = Infinity;
            for (const arcIndex of list) {
                const arc = arcs[arcIndex];
                if (arc && arc.cap > 0) {
                    minNeighborHeight = Math.min(minNeighborHeight, height[arc.to] ?? Infinity);
                }
            }
            const oldHeight = height[u] ?? 0;
            const newHeight =
                minNeighborHeight === Infinity ? 2 * n : minNeighborHeight + 1;
            height[u] = newHeight;
            currentArc[u] = 0;
            relabels += 1;
            counts[Math.min(oldHeight, counts.length - 1)] =
                (counts[Math.min(oldHeight, counts.length - 1)] ?? 0) - 1;
            counts[Math.min(newHeight, counts.length - 1)] =
                (counts[Math.min(newHeight, counts.length - 1)] ?? 0) + 1;
            emit(
                u,
                -1,
                `No admissible arc from ${vertices[u]}: relabeled ${oldHeight} to ${newHeight}.`,
                4,
                { pushes, relabels, gaps },
            );

            if ((counts[Math.min(oldHeight, counts.length - 1)] ?? 0) === 0 && oldHeight < n) {
                for (let v = 0; v < n; v += 1) {
                    if ((height[v] ?? 0) > oldHeight && (height[v] ?? 0) < n) {
                        height[v] = n;
                    }
                }
                counts = recount();
                gaps += 1;
                emit(
                    -1,
                    -1,
                    `Gap at height ${oldHeight}: raised all higher labels to ${n}.`,
                    5,
                    { pushes, relabels, gaps },
                );
            }
        }
        return (excess[u] ?? 0) === 0;
    };

    while (operations <= 200000) {
        let chosen = -1;
        for (let v = 0; v < n; v += 1) {
            if (v === source || v === sink || (excess[v] ?? 0) <= 0) {
                continue;
            }
            if (chosen === -1 || (height[v] ?? 0) > (height[chosen] ?? 0)) {
                chosen = v;
            }
        }
        if (chosen === -1) {
            break;
        }
        discharge(chosen);
    }

    const maxFlow = Math.max(0, excess[sink] ?? 0);
    emit(-1, -1, `Maximum flow from ${sourceLabel} to ${sinkLabel} is ${maxFlow}.`, 6, {
        maxFlow,
        pushes,
        relabels,
        gaps,
    });

    yield* frames;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Push-relabel keeps a height for every vertex and only ever pushes to a neighbor one level lower. If a vertex cannot get rid of its excess, raising its label creates a lower neighbor. Choosing the tallest active vertex first concentrates work where flow is closest to the sink, so excess drains in fewer operations than a simple scan order.",
        invariants: [
            "For every residual arc u to v, height[u] is at most height[v] plus one.",
            "Excess is nonnegative at every vertex except the source, which holds the negative total.",
            "An admissible arc always drops exactly one height level.",
            "The sink never relabels, so any flow reaching it stays there.",
        ],
        correctness:
            "Relabeling preserves the height-function invariant because the new label is one more than the smallest height of a residual neighbor. Pushes only traverse admissible arcs, so flow conservation is maintained at interior vertices. When a height level empties, no vertex above it can reach the sink, so raising those labels is safe. Once no active vertex holds excess, the preflow is a feasible flow, and by the max-flow min-cut theorem it is maximum.",
        complexityRationale:
            "The highest-label rule with the gap heuristic bounds relabels and pushes by O(V^2 sqrt(E)) in the worst case. Residuals, heights, excess values, and counters occupy O(V + E) space.",
        uses: [
            "Maximum flow on dense networks where Dinic rebuilds expensive level graphs",
            "Bipartite matching and image segmentation energy minimization",
            "A teaching example of local operations replacing global path searches",
        ],
        references: [
            "Goldberg and Tarjan, A New Approach to the Maximum-Flow Problem, Journal of the ACM, 1988",
            "Ahuja, Magnanti, and Orlin, Network Flows, Chapter 7",
        ],
        workedExample:
            "With S->A (3), S->B (2), A->B (1), A->T (2), B->T (3), the preflow puts 3 excess on A and 2 on B, both at height 1 while S has height 4. The tallest active vertex pushes 2 from A to T, then A and B push their remaining units through B to T. All excess drains and the sink holds 5.",
    },
    id: "highest-label-push-relabel",
    name: "Highest-Label Push-Relabel",
    category: "flow",
    complexity: { time: "O(V^2 * sqrt(E))", space: "O(V + E)" },
    defaultInput: {
        vertices: ["S", "A", "B", "T"],
        edges: [
            ["S", "A", 3],
            ["S", "B", 2],
            ["A", "B", 1],
            ["A", "T", 2],
            ["B", "T", 3],
        ],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize heights with the source at vertex count",
        "saturate every arc leaving the source into a preflow",
        "while an active vertex has positive excess",
        "choose the active vertex with the largest height",
        "push along an arc to a neighbor one level lower",
        "if no admissible arc exists, relabel above the lowest neighbor",
        "if a height level empties, raise all labels above it",
        "when excess is drained, report the sink's received flow",
    ],
};

export default module;
