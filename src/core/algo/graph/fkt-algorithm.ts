/**
 * fkt-algorithm.ts - Bounded Search Tree for Feedback Vertex Set
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The FPT algorithm behind the feedback vertex set problem uses the parameter
 * k, the number of vertices we are allowed to delete. Find any cycle: every
 * feedback vertex set must contain at least one vertex of it, so branch on
 * each of those vertices, delete it, and recurse with k reduced by one. If the
 * graph becomes acyclic we have a solution; if k reaches zero while a cycle
 * remains, the branch fails. Increasing k from zero upward returns a minimum
 * feedback vertex set.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(r^k * (V + E)) where r is the longest cycle branched on
 *   Space: O(V + E + k) for recursion and graph copies
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes on the cycle chosen for branching are yellow.
 *   - Nodes already deleted into the feedback set are red.
 *   - Surviving acyclic nodes are green in the final frame.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Graph = Map<string, Set<string>>;

interface Snapshot {
    graph: Graph;
    cycle: string[];
    chosen: string[];
    remaining: number;
}

function copyGraph(graph: Graph): Graph {
    const result = new Map<string, Set<string>>();
    for (const [vertex, neighbors] of graph) {
        result.set(vertex, new Set(neighbors));
    }
    return result;
}

function findCycle(graph: Graph): string[] | null {
    const color = new Map<string, number>();
    const stack: string[] = [];
    const visit = (vertex: string, parent: string | null): string[] | null => {
        color.set(vertex, 1);
        stack.push(vertex);
        for (const neighbor of graph.get(vertex) ?? []) {
            if (neighbor === parent) continue;
            if (color.get(neighbor) === 1) {
                const start = stack.indexOf(neighbor);
                return stack.slice(Math.max(0, start));
            }
            if (!color.has(neighbor)) {
                const found = visit(neighbor, vertex);
                if (found) return found;
            }
        }
        stack.pop();
        color.set(vertex, 2);
        return null;
    };
    for (const vertex of graph.keys()) {
        if (color.has(vertex)) continue;
        const found = visit(vertex, null);
        if (found) return found;
    }
    return null;
}

function buildEntities(
    vertices: string[],
    graph: Graph,
    cycle: string[],
    chosen: string[],
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const cycleSet = new Set(cycle);
    const chosenSet = new Set(chosen);
    const alive = vertices.filter((v) => !chosenSet.has(v));
    const nodes = vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: (chosenSet.has(label)
            ? "error"
            : cycleSet.has(label)
              ? "comparing"
              : alive.includes(label) && findCycle(graph) === null
                ? "sorted"
                : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < vertices.length; i += 1) {
        for (let j = i + 1; j < vertices.length; j += 1) {
            const a = vertices[i] ?? "";
            const b = vertices[j] ?? "";
            if (!(graph.get(a)?.has(b) ?? false)) continue;
            edges.push({
                id: `edge-${a}-${b}`,
                sourceId: `node-${a}`,
                targetId: `node-${b}`,
                label: "",
                state: cycleSet.has(a) && cycleSet.has(b) ? "comparing" : "idle",
                directed: false,
            });
        }
    }
    return { nodes, edges };
}

function* search(graph: Graph, budget: number, chosen: string[]): Generator<Snapshot, string[] | null, unknown> {
    const cycle = findCycle(graph);
    if (!cycle) {
        return chosen;
    }
    yield { graph, cycle, chosen: [...chosen], remaining: budget };
    if (budget === 0) {
        return null;
    }
    for (const vertex of cycle) {
        const reduced = copyGraph(graph);
        for (const neighbors of reduced.values()) neighbors.delete(vertex);
        reduced.delete(vertex);
        const result = yield* search(reduced, budget - 1, [...chosen, vertex]);
        if (result) return result;
    }
    return null;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; k?: number } | null) ?? {};
    const adjacency = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["B", "C"],
    };
    const vertices = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const graph = new Map<string, Set<string>>();
    for (const vertex of vertices) graph.set(vertex, new Set());
    for (const [source, neighbors] of Object.entries(adjacency)) {
        for (const target of neighbors) {
            graph.get(source)?.add(target);
            graph.get(target)?.add(source);
        }
    }
    let step = 0;
    const snapshot = (
        description: string,
        codeLineNumber: number,
        state: Snapshot,
        meta: Record<string, number | string | boolean | number[] | string[]>,
    ): VisualFrame => {
        const entities = buildEntities(vertices, state.graph, state.cycle, state.chosen);
        return {
            stepNumber: step,
            entities: entities.nodes,
            edges: entities.edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta,
        };
    };

    yield snapshot("Feedback vertex set by bounded search: find a cycle and branch on its vertices.", 0, { graph, cycle: [], chosen: [], remaining: 0 }, { vertices: vertices.length, chosen: 0 });
    step += 1;

    if (vertices.length === 0) {
        yield snapshot("Empty graph - the feedback vertex set is empty.", 0, { graph, cycle: [], chosen: [], remaining: 0 }, { vertices: 0, chosen: 0, size: 0 });
        return;
    }

    const limit = typeof task.k === "number" ? Math.max(0, Math.floor(task.k)) : vertices.length;
    let answer: string[] | null = null;
    for (let budget = 0; budget <= limit; budget += 1) {
        const iterator = search(copyGraph(graph), budget, []);
        let next = iterator.next();
        while (!next.done) {
            const state = next.value;
            if (step < 200) {
                yield snapshot(
                    `Budget ${budget}: branch on the cycle ${state.cycle.join("-")} (${state.chosen.length} deleted so far).`,
                    2,
                    state,
                    { vertices: vertices.length, budget, chosen: state.chosen.length, cycleLength: state.cycle.length },
                );
                step += 1;
            }
            next = iterator.next();
        }
        if (next.value) {
            answer = next.value;
            break;
        }
    }

    if (answer) {
        const survivors = vertices.filter((v) => !answer?.includes(v));
        const finalState: Snapshot = { graph, cycle: [], chosen: answer, remaining: 0 };
        const final = snapshot(
            `Minimum feedback vertex set has size ${answer.length}: ${answer.join(", ")}. The remaining graph is acyclic.`,
            6,
            finalState,
            { vertices: vertices.length, size: answer.length, chosen: answer, survivors },
        );
        yield {
            ...final,
            entities: final.entities.map((node) =>
                survivors.includes(String(node.label)) ? { ...node, state: "sorted" as EntityState } : node,
            ),
        };
    } else {
        yield snapshot(`No feedback vertex set of size at most ${limit} exists.`, 7, { graph, cycle: [], chosen: [], remaining: 0 }, { vertices: vertices.length, size: -1 });
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Any cycle must lose at least one vertex before the graph can become a forest. The search tree tries deleting each vertex of the current cycle in turn and spends one unit of the parameter k per deletion. Iterating k upward means the first success is a smallest possible feedback vertex set.",
        invariants: [
            "Every branch deletes vertices that lie on a cycle of the current graph.",
            "The remaining budget decreases by exactly one on each deletion.",
            "A branch succeeds only after the graph contains no cycle at all.",
        ],
        correctness:
            "Any feedback vertex set intersects the chosen cycle, so at least one branch covers some optimal solution. Inducting on k, if a set of size k exists the algorithm finds one, and if it reports success the deleted vertices are exactly those removed from a graph it verified to be acyclic. Testing k in increasing order therefore yields a minimum set.",
        complexityRationale:
            "Each recursion level branches on at most r cycle vertices and copies the graph in O(V+E), so the time is O(r^k*(V+E)) with O(V+E+k) working space.",
        uses: [
            "Breaking circular waits in dependency graphs",
            "Making a constraint graph acyclic for inference",
            "A canonical example of fixed-parameter tractable branching",
        ],
        references: [
            "Cygan et al., Parameterized Algorithms, chapter on feedback vertex set",
            "Downey and Fellows, Parameterized Complexity",
        ],
        workedExample:
            "For a four-cycle A-B-C-D-A, no budget of zero works. With budget one the algorithm finds the cycle, tries deleting A first, and the remaining path B-C-D is acyclic, so the single vertex A is a minimum feedback vertex set.",
    },
    id: "fkt-algorithm",
    name: "FKT Feedback Vertex Set Algorithm",
    category: "graph",
    complexity: { time: "O(r^k * (V + E))", space: "O(V + E + k)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "set the deletion budget k and an empty candidate set",
        "find any cycle in the current graph",
        "if no cycle remains, return the candidate set",
        "if the budget is zero, discard this branch",
        "for each vertex on the cycle, branch by deleting it",
        "recurse with the budget reduced by one",
        "stop at the first success for the smallest budget",
        "done: report the minimum feedback vertex set",
    ],
};

export default module;
