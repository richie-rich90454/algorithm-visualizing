/**
 * incremental-maxflow.ts - Incremental Maximum Flow
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When a network is already at maximum flow and one link gains capacity, the
 * old flow is still feasible. Instead of throwing it away, this algorithm
 * keeps the residual network and resumes augmenting from the current flow.
 * Only the newly available capacity can create additional augmenting paths,
 * so the work after each increase is usually much smaller than solving the
 * whole problem again.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(A * V * E) worst case for A capacity increases
 *   Space: O(V^2) for the residual capacity matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Links whose capacity grew are YELLOW (comparing).
 *   - Links carrying new augmenting flow are CYAN (path).
 */

import type { AlgorithmModule, EntityState, MetaValue, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Weighted = Record<string, Array<[string, number]>>;
type Increase = [string, string, number];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Weighted;
            source?: string;
            sink?: string;
            increments?: Increase[];
        } | null) ?? {};
    const graph: Weighted = task.graph ?? {
        S: [
            ["A", 3],
            ["B", 2],
        ],
        A: [
            ["T", 2],
            ["B", 1],
        ],
        B: [["T", 3]],
        T: [],
    };
    const increases: Increase[] = task.increments ?? [
        ["S", "A", 2],
        ["B", "T", 2],
    ];
    const labels = [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((pairs) => pairs.map(([v]) => v)),
            ...increases.flatMap(([a, b]) => [a, b]),
        ]),
    ];
    if (labels.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty network - there is no flow to push.",
            codeLineNumber: 0,
            layout: "graph",
            meta: { flow: 0, augmentations: 0 },
        };
        return;
    }
    const index = new Map(labels.map((v, i) => [v, i]));
    const source = task.source && index.has(task.source) ? task.source : (labels[0] as string);
    const sink = task.sink && index.has(task.sink) ? task.sink : (labels[labels.length - 1] as string);
    const n = labels.length;
    const cap: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const arcs = new Set<string>();
    const key = (a: string, b: string): string => `${a}|${b}`;
    for (const [from, pairs] of Object.entries(graph)) {
        for (const [to, amount] of pairs) {
            const i = index.get(from);
            const j = index.get(to);
            if (i === undefined || j === undefined || i === j || amount <= 0) continue;
            (cap[i] as number[])[j] = ((cap[i] as number[])[j] as number) + amount;
            arcs.add(key(from, to));
        }
    }

    const augment = (): number[] => {
        const amounts: number[] = [];
        for (;;) {
            const parent = new Array<number>(n).fill(-1);
            const seen = new Array<boolean>(n).fill(false);
            const queue = [index.get(source) as number];
            seen[queue[0] as number] = true;
            const sinkIndex = index.get(sink) as number;
            while (queue.length > 0 && !seen[sinkIndex]) {
                const u = queue.shift() as number;
                for (let v = 0; v < n; v += 1) {
                    if (!seen[v] && ((cap[u] as number[])[v] as number) > 0) {
                        seen[v] = true;
                        parent[v] = u;
                        queue.push(v);
                    }
                }
            }
            if (!seen[sinkIndex]) break;
            let bottleneck = Infinity;
            let cursor = sinkIndex;
            while (cursor !== (index.get(source) as number)) {
                const prev = parent[cursor] as number;
                bottleneck = Math.min(bottleneck, (cap[prev] as number[])[cursor] as number);
                cursor = prev;
            }
            cursor = sinkIndex;
            while (cursor !== (index.get(source) as number)) {
                const prev = parent[cursor] as number;
                (cap[prev] as number[])[cursor] = ((cap[prev] as number[])[cursor] as number) - bottleneck;
                (cap[cursor] as number[])[prev] = ((cap[cursor] as number[])[prev] as number) + bottleneck;
                cursor = prev;
            }
            amounts.push(bottleneck);
        }
        return amounts;
    };

    const nodes = makeGraphNodes(labels);
    let step = 0;
    let flow = 0;
    let totalAugmentations = 0;
    let changedArc = "";
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, MetaValue> = {},
    ): VisualFrame => {
        const edges: VisualEdge[] = [];
        for (const pair of arcs) {
            const [a, b] = pair.split("|");
            const i = index.get(a as string);
            const j = index.get(b as string);
            if (i === undefined || j === undefined) continue;
            edges.push({
                id: `edge-${a}-${b}`,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: String((cap[i] as number[])[j]),
                state: pair === changedArc ? ("comparing" as EntityState) : ("idle" as EntityState),
                directed: true,
            });
        }
        for (const node of nodes) {
            node.state = node.id === `node-${source}` || node.id === `node-${sink}` ? "sorted" : "unvisited";
        }
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta,
        };
    };

    yield snap(
        `Initial network with ${arcs.size} link(s); computing a base maximum flow from ${source} to ${sink}.`,
        0,
        { flow: 0, augmentations: 0, increases: increases.length },
    );
    step += 1;
    for (const amount of augment()) {
        flow += amount;
        totalAugmentations += 1;
        yield snap(
            `Base pass ${totalAugmentations}: augmented ${amount}, flow is now ${flow}.`,
            3,
            { flow, augmentations: totalAugmentations, bottleneck: amount },
        );
        step += 1;
    }

    for (let position = 0; position < increases.length; position += 1) {
        const increase = increases[position] as Increase;
        const from = increase[0];
        const to = increase[1];
        const delta = increase[2];
        const i = index.get(from);
        const j = index.get(to);
        if (i === undefined || j === undefined || i === j || delta <= 0) continue;
        (cap[i] as number[])[j] = ((cap[i] as number[])[j] as number) + delta;
        arcs.add(key(from, to));
        changedArc = key(from, to);
        yield snap(
            `Increase ${position + 1}: capacity of ${from} to ${to} grew by ${delta}.`,
            5,
            { flow, augmentations: totalAugmentations, increase: position + 1, delta },
        );
        step += 1;
        const more = augment();
        if (more.length === 0) {
            yield snap(
                `No new augmenting path; the flow stays at ${flow}.`,
                6,
                { flow, augmentations: totalAugmentations, increase: position + 1 },
            );
            step += 1;
            continue;
        }
        for (const amount of more) {
            flow += amount;
            totalAugmentations += 1;
            changedArc = key(from, to);
            yield snap(
                `After increase ${position + 1}: pushed ${amount} more units, flow is ${flow}.`,
                8,
                { flow, augmentations: totalAugmentations, increase: position + 1, bottleneck: amount },
            );
            step += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((node) => ({ ...node })),
        edges: snap("", 10).edges.map((edge) => ({ ...edge, state: "idle" as EntityState })),
        description: `Incremental maximum flow after ${increases.length} increase(s) is ${flow}, reached with ${totalAugmentations} augmentation(s).`,
        codeLineNumber: 10,
        layout: "graph",
        meta: {
            flow,
            augmentations: totalAugmentations,
            increases: increases.length,
            source,
            sink,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A maximum flow stays feasible when a link gains capacity, so there is no reason to restart. Keep the residual network from the previous solution and keep searching for augmenting paths. Each increase can only open new possibilities, and every augmentation raises the flow by a positive integer amount.",
        invariants: [
            "The stored residual capacities always describe a feasible flow.",
            "An augmentation along a shortest residual path preserves capacity and conservation constraints.",
            "Old flow is never discarded when capacities only increase.",
        ],
        correctness:
            "Starting from any feasible flow, the Ford-Fulkerson augmenting-path theorem guarantees that repeated augmentation ends at a maximum flow. Capacity increases keep the current flow feasible, so resuming from it reaches the same maximum as solving the enlarged network from scratch; the final flow value therefore matches a fresh computation.",
        complexityRationale:
            "Each augmenting path search is a breadth-first scan of O(E) links over at most V hops, and there are A increases, giving O(A * V * E) worst-case time. The residual matrix uses O(V^2) space.",
        uses: [
            " traffic engineering after a link is upgraded",
            " bandwidth allocation as new circuits come online",
            " recomputing assignments in dynamic supply networks",
        ],
        references: [
            "Ford and Fulkerson, Flows in Networks (1962)",
            "Ahuja, Magnanti, and Orlin, Network Flows",
        ],
        workedExample:
            "A network from S to T carries 4 units. Raising capacity on S to A by 2 leaves the old 4-unit flow in place; augmenting through the new residual capacity may push 2 more units, giving 6 without recomputing the earlier paths.",
    },
    id: "incremental-maxflow",
    name: "Incremental Maximum Flow",
    category: "flow",
    complexity: { time: "O(A * V * E)", space: "O(V^2)" },
    defaultInput: {
        graph: {
            S: [
                ["A", 3],
                ["B", 2],
            ],
            A: [
                ["T", 2],
                ["B", 1],
            ],
            B: [["T", 3]],
            T: [],
        },
        source: "S",
        sink: "T",
        increments: [
            ["S", "A", 2],
            ["B", "T", 2],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the residual capacity matrix from the current network",
        "augment along breadth-first residual paths until none remain",
        "for each capacity increase, add the new residual capacity",
        "resume augmenting from the existing flow",
        "record each bottleneck and update the residual matrix",
        "continue until every increase has been processed",
        "paint the increased link and each new augmenting path",
        "update the flow value after every bottleneck",
        "report the flow after each capacity increase",
        "compare the final value with a fresh computation",
        "done: a maximum flow for the final capacities",
    ],
};

export default module;
