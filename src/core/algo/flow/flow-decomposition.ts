/**
 * flow-decomposition.ts - Flow Decomposition into Paths and Cycles
 *
 * Any feasible flow can be written as a collection of source-to-sink paths
 * plus a collection of directed cycles. The algorithm repeatedly finds a path
 * from source to sink using edges with positive flow, peels off the smallest
 * flow on that path, and repeats. When no path remains it peels off cycles the
 * same way until every edge carries zero flow.
 *
 * Time: O(f * (V + E)) where f is the number of peeled paths and cycles
 * Space: O(V + E) for the residual flow map and the decomposition
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface FlowInput {
    source: string;
    sink: string;
    edges: Array<{ u: string; v: string; capacity: number; flow: number }>;
}

interface Arc {
    u: string;
    v: string;
    capacity: number;
    flow: number;
}

function findFlowPath(
    nodes: string[],
    flow: Map<string, number>,
    source: string,
    sink: string,
): string[] | null {
    const visited = new Set<string>([source]);
    const stack: Array<{ node: string; path: string[] }> = [{ node: source, path: [] }];
    while (stack.length > 0) {
        const current = stack.pop() as { node: string; path: string[] };
        if (current.node === sink) {
            return current.path;
        }
        for (const next of nodes) {
            const key = `${current.node}->${next}`;
            if ((flow.get(key) ?? 0) > 0 && !visited.has(next)) {
                visited.add(next);
                stack.push({ node: next, path: [...current.path, key] });
            }
        }
    }
    return null;
}

function findFlowCycle(nodes: string[], flow: Map<string, number>, start: string): string[] | null {
    const visited = new Set<string>([start]);
    const stack: Array<{ node: string; path: string[] }> = [{ node: start, path: [] }];
    while (stack.length > 0) {
        const current = stack.pop() as { node: string; path: string[] };
        for (const next of nodes) {
            const key = `${current.node}->${next}`;
            if ((flow.get(key) ?? 0) <= 0) {
                continue;
            }
            if (next === start && current.path.length > 0) {
                return [...current.path, key];
            }
            if (!visited.has(next)) {
                visited.add(next);
                stack.push({ node: next, path: [...current.path, key] });
            }
        }
    }
    return null;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<FlowInput> | null) ?? {};
    const source = task.source ?? "S";
    const sink = task.sink ?? "T";
    const arcs: Arc[] = (task.edges ?? [
        { u: "S", v: "A", capacity: 5, flow: 3 },
        { u: "S", v: "B", capacity: 4, flow: 2 },
        { u: "A", v: "B", capacity: 2, flow: 1 },
        { u: "A", v: "T", capacity: 4, flow: 2 },
        { u: "B", v: "T", capacity: 5, flow: 3 },
        { u: "B", v: "A", capacity: 1, flow: 0 },
    ]).map((arc) => ({ ...arc }));

    const nodes = [...new Set(arcs.flatMap((arc) => [arc.u, arc.v]))];
    const flow = new Map<string, number>();
    for (const arc of arcs) {
        flow.set(`${arc.u}->${arc.v}`, arc.flow);
    }
    const totalFlow = arcs
        .filter((arc) => arc.u === source)
        .reduce((sum, arc) => sum + arc.flow, 0);

    const pieces: Array<{ kind: "path" | "cycle"; edges: string[]; amount: number }> = [];
    let step = 0;

    const frame = (active: Set<string>, description: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = nodes.map((node, index) => ({
            id: `node-${index}`,
            type: "node" as const,
            label: node,
            value: node,
            state: (node === source || node === sink ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, name: node, source: node === source, sink: node === sink },
        }));
        const edges: VisualEdge[] = arcs.map((arc, index) => {
            const key = `${arc.u}->${arc.v}`;
            return {
                id: `edge-${index}`,
                sourceId: `node-${nodes.indexOf(arc.u)}`,
                targetId: `node-${nodes.indexOf(arc.v)}`,
                label: `${flow.get(key) ?? 0}/${arc.capacity}`,
                state: active.has(key) ? "active" : "idle",
                directed: true,
            } as VisualEdge;
        });
        const result: VisualFrame = {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                source,
                sink,
                totalFlow,
                peeled: pieces.length,
                paths: pieces
                    .filter((piece) => piece.kind === "path")
                    .map((piece) => `${piece.amount}:${piece.edges.join(" ")}`),
                cycles: pieces
                    .filter((piece) => piece.kind === "cycle")
                    .map((piece) => `${piece.amount}:${piece.edges.join(" ")}`),
            },
        };
        step += 1;
        return result;
    };

    yield frame(new Set(), `Decomposing a flow of value ${totalFlow} into paths and cycles.`, 0);

    while (true) {
        const path = findFlowPath(nodes, flow, source, sink);
        if (path) {
            const amount = Math.min(...path.map((key) => flow.get(key) as number));
            for (const key of path) {
                flow.set(key, (flow.get(key) as number) - amount);
            }
            pieces.push({ kind: "path", edges: path, amount });
            yield frame(
                new Set(path),
                `Peeled an ${amount}-unit source-to-sink path through ${path.length} arc(s).`,
                2,
            );
            continue;
        }

        const remainingKey = [...flow.entries()].find(([, value]) => value > 0)?.[0];
        if (!remainingKey) {
            break;
        }
        const start = remainingKey.split("->")[0] as string;
        const cycle = findFlowCycle(nodes, flow, start);
        if (!cycle) {
            break;
        }
        const amount = Math.min(...cycle.map((key) => flow.get(key) as number));
        for (const key of cycle) {
            flow.set(key, (flow.get(key) as number) - amount);
        }
        pieces.push({ kind: "cycle", edges: cycle, amount });
        yield frame(new Set(cycle), `Peeled an ${amount}-unit directed cycle through ${cycle.length} arc(s).`, 4);
    }

    yield frame(new Set(), `Flow decomposed into ${pieces.length} path or cycle piece(s).`, 6);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A flow that branches and merges looks complicated, but it can always be unraveled. Follow any positive-flow edge from the source until reaching the sink, subtract the smallest flow on that route, and repeat. Whatever positive flow remains cannot reach the sink, so it must circulate in cycles that can be peeled off the same way.",
        invariants: [
            "Peeling a path or cycle preserves conservation at every vertex.",
            "Every peeled amount is positive and no arc ever carries negative flow.",
            "The total amount peeled on source-to-sink paths equals the original flow value.",
        ],
        correctness:
            "Removing a path of value delta from a feasible flow leaves a feasible flow, because the same delta enters and leaves each internal vertex. The same holds for a cycle. When no source-to-sink path exists, flow conservation forces every remaining positive-flow component to contain a directed cycle, so the loop terminates only when all flow is accounted for. The collected pieces therefore reconstruct the original flow exactly.",
        complexityRationale:
            "Each piece reduces at least one arc to zero, so at most E pieces are peeled; a graph search per piece costs O(V + E), giving O(E (V + E)) total time. The residual flow map and the decomposition use O(V + E) space.",
        uses: [
            "Explaining how a computed flow breaks into actual routes",
            "Turning a min-cost flow into individual shipments",
            "Detecting circulations that remain after extracting demand",
        ],
        references: [
            "Ahuja, Magnanti and Orlin, Network Flows, Chapter 3",
            "CLRS, Introduction to Algorithms, Chapter 26",
        ],
        workedExample:
            "With S to A carrying 3, A to T carrying 2, S to B carrying 2, B to T carrying 3, A to B carrying 1, the peel finds S-A-T of 2, then S-A-B-T of 1, then S-B-T of 2. No positive flow remains, so the decomposition has three paths and no cycles.",
    },
    id: "flow-decomposition",
    name: "Flow Decomposition",
    category: "flow",
    complexity: { time: "O(E (V + E))", space: "O(V + E)" },
    defaultInput: {
        source: "S",
        sink: "T",
        edges: [
            { u: "S", v: "A", capacity: 5, flow: 3 },
            { u: "S", v: "B", capacity: 4, flow: 2 },
            { u: "A", v: "B", capacity: 2, flow: 1 },
            { u: "A", v: "T", capacity: 4, flow: 2 },
            { u: "B", v: "T", capacity: 5, flow: 3 },
            { u: "B", v: "A", capacity: 1, flow: 0 },
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "copy the flow into a residual flow map",
        "while a source-to-sink path of positive flow exists, find one",
        "peel off the minimum flow along that path and record it",
        "when no path remains, find a directed cycle of positive flow",
        "peel off the minimum flow along that cycle and record it",
        "stop when no positive flow remains",
        "done: report the path and cycle decomposition",
    ],
};

export default module;
