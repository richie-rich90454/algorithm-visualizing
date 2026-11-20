/**
 * distributed-deadlock-detection.ts - Distributed Deadlock Detection
 *
 * Builds the global wait-for graph from per-site wait relationships, finds
 * every strongly connected component that forms a cycle, and breaks each
 * deadlock by aborting one victim process until the graph is acyclic.
 *
 * Time:  O(V * (V + E)) in the worst case (repeated SCC scans)
 * Space: O(V + E) for the graph and its residual copies
 *
 * Visualization: process nodes are colored by site; a live cycle is red, an
 * aborted victim is highlighted, and the final frame is green when deadlock-free.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type WaitEdge = [string, string];

/** Tarjan strongly connected components of a directed graph. */
export function sccs(nodes: string[], edges: WaitEdge[]): string[][] {
    const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
    for (const [from, to] of edges) {
        if (adj.has(from)) (adj.get(from) as string[]).push(to);
    }
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const out: string[][] = [];
    let counter = 0;
    const visit = (v: string): void => {
        index.set(v, counter);
        low.set(v, counter);
        counter += 1;
        stack.push(v);
        onStack.add(v);
        for (const w of adj.get(v) ?? []) {
            if (!index.has(w)) {
                visit(w);
                low.set(v, Math.min(low.get(v) as number, low.get(w) as number));
            } else if (onStack.has(w)) {
                low.set(v, Math.min(low.get(v) as number, index.get(w) as number));
            }
        }
        if (low.get(v) === index.get(v)) {
            const comp: string[] = [];
            let w = "";
            do {
                w = stack.pop() as string;
                onStack.delete(w);
                comp.push(w);
            } while (w !== v);
            out.push(comp);
        }
    };
    for (const n of nodes) {
        if (!index.has(n)) visit(n);
    }
    return out;
}

/** Components that contain a cycle (size > 1, or a self-loop). */
export function deadlockedGroups(nodes: string[], edges: WaitEdge[]): string[][] {
    const selfLoops = new Set(edges.filter(([a, b]) => a === b).map(([a]) => a));
    return sccs(nodes, edges).filter((c) => c.length > 1 || (c.length === 1 && selfLoops.has(c[0] as string)));
}

/** Build process nodes; state and aborted set control the highlight. */
function makeNodes(
    nodes: string[],
    sites: number[],
    states: Map<string, EntityState>,
): VisualEntity[] {
    return nodes.map((id, i) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: id,
        state: states.get(id) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { site: sites[i] ?? 0, index: i },
    }));
}

/** Build wait-for edges; only edges whose endpoints are still active survive. */
function makeEdges(edges: WaitEdge[], aborted: Set<string>, active: Set<string>): VisualEdge[] {
    const result: VisualEdge[] = [];
    edges.forEach(([from, to], i) => {
        if (aborted.has(from) || aborted.has(to)) return;
        result.push({
            id: `wait-${i}`,
            sourceId: `node-${from}`,
            targetId: `node-${to}`,
            label: "",
            state: active.has(from) && active.has(to) ? "active" : "idle",
            directed: true,
        });
    });
    return result;
}

/** Choose the victim with the largest outdegree in the current graph. */
function pickVictim(group: string[], edges: WaitEdge[], order: string[]): string {
    let best = group[0] as string;
    let bestOut = -1;
    for (const id of group) {
        const out = edges.filter(([a]) => a === id).length;
        if (out > bestOut || (out === bestOut && order.indexOf(id) > order.indexOf(best))) {
            best = id;
            bestOut = out;
        }
    }
    return best;
}

/** The distributed deadlock detection generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { processes?: string[]; sites?: number[]; waits?: WaitEdge[] } | null) ?? {};
    const nodes: string[] = Array.isArray(task.processes) && task.processes.length > 0
        ? task.processes.map(String)
        : ["P0", "P1", "P2", "P3"];
    const sites: number[] = Array.isArray(task.sites) ? task.sites.map((n) => Number(n) || 0) : nodes.map((_, i) => i % 2);
    const edges: WaitEdge[] = Array.isArray(task.waits)
        ? task.waits.filter((e) => Array.isArray(e) && e.length === 2).map((e) => [String(e[0]), String(e[1])])
        : [["P0", "P1"], ["P1", "P2"], ["P2", "P0"], ["P3", "P0"]];
    const aborted = new Set<string>();
    const victims: string[] = [];
    let detected = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(nodes, sites, new Map()),
        edges: makeEdges(edges, aborted, new Set()),
        description: `Assembled ${nodes.length} site processes and ${edges.length} wait-for edges into the global graph.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "build", processes: nodes, sites, victims: [], cycles: 0, deadlockFree: false },
    };
    step += 1;

    for (;;) {
        const activeEdges: WaitEdge[] = edges.filter(([a, b]) => !aborted.has(a) && !aborted.has(b));
        const groups = deadlockedGroups(nodes.filter((n) => !aborted.has(n)), activeEdges);
        if (groups.length === 0) break;

        for (const group of groups) {
            detected += 1;
            const states = new Map<string, EntityState>();
            for (const id of group) states.set(id, "error");
            for (const id of aborted) states.set(id, "swapped");
            yield {
                stepNumber: step,
                entities: makeNodes(nodes, sites, states),
                edges: makeEdges(edges, aborted, new Set(group)),
                description: `Cycle ${detected}: ${group.join(" -> ")} -> ${group[0]} is a distributed deadlock.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { phase: "detect", processes: nodes, sites, victims: [...victims], cycles: detected, group },
            };
            step += 1;
        }

        for (const group of groups) {
            const victim = pickVictim(group, activeEdges, nodes);
            aborted.add(victim);
            victims.push(victim);
        }
        const states = new Map<string, EntityState>();
        for (const id of aborted) states.set(id, "swapped");
        yield {
            stepNumber: step,
            entities: makeNodes(nodes, sites, states),
            edges: makeEdges(edges, aborted, new Set()),
            description: `Aborted victim(s) ${victims.slice(-groups.length).join(", ")} to break the cycle(s).`,
            codeLineNumber: 4,
            layout: "graph",
            meta: { phase: "abort", processes: nodes, sites, victims: [...victims], cycles: detected, group: [] },
        };
        step += 1;
    }

    const survivors = nodes.filter((n) => !aborted.has(n));
    const finalStates = new Map<string, EntityState>();
    for (const id of survivors) finalStates.set(id, "sorted");
    for (const id of aborted) finalStates.set(id, "swapped");
    yield {
        stepNumber: step,
        entities: makeNodes(nodes, sites, finalStates),
        edges: makeEdges(edges, aborted, new Set()),
        description: `Deadlock resolved: ${detected} cycle(s) found, ${victims.length} victim(s) aborted, wait-for graph now acyclic.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            phase: "done",
            processes: nodes,
            sites,
            victims,
            cycles: detected,
            deadlockFree: true,
            survivors,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every process that is blocked records which other process it awaits, forming a wait-for graph across sites. A deadlock exists exactly when that graph contains a cycle. Assemble the edges from all sites, find each cycle with strongly connected components, abort one process in every cycle, and repeat until no cycle remains.",
        invariants: [
            "A wait-for edge always points from a blocked process to the process holding what it needs.",
            "A process cannot proceed while it has an outgoing wait-for edge to a blocked process.",
            "Each abort round removes at least one process, so the loop terminates.",
        ],
        correctness:
            "A directed cycle in the wait-for graph means every member waits, directly or transitively, on another member, so none can proceed. Tarjan's algorithm finds every strongly connected component; a component with more than one node, or a self-loop, contains a cycle. Aborting one member of each component destroys every cycle in it. Recomputing the components after each round and repeating until none are cyclic therefore leaves an acyclic wait-for graph, which is a deadlock-free state.",
        complexityRationale:
            "Each round runs Tarjan's depth-first search over V nodes and E edges, O(V + E), and removes at least one process, so at most V rounds occur: O(V(V + E)) worst case. The graph, its residual copies, and the component stack use O(V + E) space.",
        uses: [
            "Deadlock detection in distributed database systems",
            "Lock-manager monitoring in clustered storage engines",
            "Cycle detection in cross-service dependency graphs",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Deadlocks chapter",
            "Tanenbaum and Woodhull, Operating Systems, distributed deadlock section",
        ],
        workedExample:
            "Sites hold P0 and P1 on one node, P2 and P3 on another, with waits P0 -> P1 -> P2 -> P0 and P3 -> P0. The component {P0, P1, P2} is a cycle while P3 is not in one. Aborting P2 breaks the only cycle; the remaining graph P3 -> P0 -> P1 is acyclic and the system is deadlock-free.",
    },
    id: "distributed-deadlock-detection",
    name: "Distributed Deadlock Detection",
    category: "parallel-distributed",
    complexity: { time: "O(V(V + E))", space: "O(V + E)" },
    defaultInput: {
        processes: ["P0", "P1", "P2", "P3"],
        sites: [0, 0, 1, 1],
        waits: [["P0", "P1"], ["P1", "P2"], ["P2", "P0"], ["P3", "P0"]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "collect every site's local wait-for edges into one graph",
        "repeat until no strongly connected component has a cycle",
        "run depth-first search to list strongly connected components",
        "mark each cyclic component as a deadlock",
        "choose one victim per cyclic component by largest outdegree",
        "abort the victims and delete every incident edge",
        "recompute the components on the residual graph",
        "done: report the victims and a deadlock-free wait-for graph",
    ],
};

export default module;
