/**
 * feedback-vertex-set.ts - Exact Feedback Vertex Set by Branching on Cycles
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A feedback vertex set is a set of vertices whose removal makes a directed
 * graph acyclic. The solver repeatedly finds a cycle and branches on which of
 * its vertices to delete. A vertex-disjoint cycle packing gives a lower bound
 * on how many more deletions are unavoidable, allowing branches to be pruned
 * once they cannot beat the best set found so far.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^V * (V + E)) worst case with cycle-packing pruning
 *   Space: O(V + E) for adjacency, recursion, and the best set
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are directed connections.
 *   - The cycle driving the current branch is highlighted.
 *   - Chosen deletion vertices are green; the best set is in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

/** Find one directed cycle, returning the vertices on it in order. */
function findCycle(vertices: string[], adjacency: Map<string, string[]>, removed: Set<string>): string[] {
    const color = new Map<string, number>(vertices.map((v) => [v, 0]));
    const stack: string[] = [];
    let result: string[] = [];
    const visit = (v: string): boolean => {
        color.set(v, 1);
        stack.push(v);
        for (const next of adjacency.get(v) ?? []) {
            if (removed.has(next) || !color.has(next)) {
                continue;
            }
            const state = color.get(next) ?? 0;
            if (state === 0) {
                if (visit(next)) {
                    return true;
                }
            } else if (state === 1) {
                const start = stack.indexOf(next);
                result = stack.slice(start);
                return true;
            }
        }
        stack.pop();
        color.set(v, 2);
        return false;
    };
    for (const v of vertices) {
        if (removed.has(v) || result.length > 0) {
            continue;
        }
        if ((color.get(v) ?? 0) === 0 && visit(v)) {
            break;
        }
    }
    return result;
}

/** Greedily pack vertex-disjoint cycles to bound the remaining deletions. */
function cyclePackingBound(
    vertices: string[],
    adjacency: Map<string, string[]>,
    removed: Set<string>,
    banned: Set<string>,
): number {
    const blocked = new Set<string>([...removed, ...banned]);
    let bound = 0;
    for (const start of vertices) {
        if (blocked.has(start)) {
            continue;
        }
        const cycle = findCycle(vertices, adjacency, blocked);
        if (cycle.length === 0) {
            break;
        }
        bound += 1;
        for (const v of cycle) {
            blocked.add(v);
        }
    }
    return bound;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]> } | null) ?? {};
    const adjacencyInput = task.adjacency ?? {
        A: ["B"],
        B: ["C", "A"],
        C: ["A", "D"],
        D: ["E"],
        E: ["C"],
    };
    const vertices = Object.keys(adjacencyInput).sort();
    const adjacency = new Map<string, string[]>(
        vertices.map((v) => [
            v,
            (adjacencyInput[v] ?? []).map(String).filter((u) => vertices.includes(u)),
        ]),
    );
    const nodes = makeGraphNodes(vertices);
    const state: { best: string[] | null; explored: number } = { best: null, explored: 0 };
    const snapshots: Array<{ cycle: string[]; removed: string[]; size: number }> = [];

    const snap = (message: string, line: number, cycle: string[], removed: string[]): VisualFrame => {
        const cycleSet = new Set(cycle);
        const removedSet = new Set(removed);
        for (const node of nodes) {
            node.state = removedSet.has(String(node.value))
                ? "sorted"
                : cycleSet.has(String(node.value))
                  ? "active"
                  : "unvisited";
        }
        const visualEdges: VisualEdge[] = [];
        for (const a of vertices) {
            for (const b of adjacency.get(a) ?? []) {
                visualEdges.push({
                    id: `edge-${a}-${b}`,
                    sourceId: `node-${a}`,
                    targetId: `node-${b}`,
                    label: "",
                    state: cycleSet.has(a) && cycleSet.has(b) ? "comparing" : "idle",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                edgeCount: visualEdges.length,
                explored: state.explored,
                bestSize: state.best?.length ?? 0,
                bestSet: state.best ? [...state.best] : [],
                currentSize: removed.length,
                currentSet: [...removed],
            },
        };
    };

    const solve = (removed: Set<string>, banned: Set<string>): void => {
        state.explored += 1;
        if (state.best && removed.size >= state.best.length) {
            return;
        }
        const cycle = findCycle(vertices, adjacency, removed);
        if (cycle.length === 0) {
            if (!state.best || removed.size < state.best.length) {
                state.best = [...removed].sort();
            }
            return;
        }
        if (
            state.best &&
            removed.size + cyclePackingBound(vertices, adjacency, removed, banned) >= state.best.length
        ) {
            return;
        }
        const candidates = cycle.filter((v) => !banned.has(v));
        if (candidates.length === 0) {
            return;
        }
        if (snapshots.length < 80) {
            snapshots.push({ cycle: [...cycle], removed: [...removed], size: removed.size });
        }
        for (const v of candidates) {
            const nextRemoved = new Set(removed);
            nextRemoved.add(v);
            solve(nextRemoved, banned);
        }
    };

    yield {
        ...snap("Searching for a minimum set of vertices to delete to break every cycle.", 1, [], []),
        stepNumber: 0,
    };
    let step = 1;

    solve(new Set<string>(), new Set<string>());

    for (const shot of snapshots) {
        yield {
            ...snap(
                `Cycle ${shot.cycle.join(" -> ")} -> ${shot.cycle[0]} must lose a vertex; branching now.`,
                3,
                shot.cycle,
                shot.removed,
            ),
            stepNumber: step,
        };
        step += 1;
    }

    const answer = state.best ?? [];
    yield {
        ...snap(
            `Minimum feedback vertex set has ${answer.length} vertex(es): {${answer.join(", ")}}.`,
            7,
            [],
            answer,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A directed graph with no cycles is a dag, and every cycle must lose at least one vertex before the graph becomes acyclic. The solver grabs a concrete cycle and tries deleting each of its vertices in turn. A packing of vertex-disjoint cycles tells it the minimum number of further deletions it could possibly need, so hopeless branches are cut off early.",
        invariants: [
            "Every cycle present before a branch is broken by at least one chosen deletion.",
            "The packing bound is a lower bound on remaining deletions.",
            "The best set found always induces an acyclic graph.",
        ],
        correctness:
            "Branching on a found cycle is exhaustive: any feedback vertex set must contain at least one vertex of that cycle, and trying each candidate covers all possibilities. When no cycle remains, the current set is feasible. The packing bound never overestimates the needed deletions because vertex-disjoint cycles require distinct vertices, so pruning cannot remove the optimum. Exhausting the search therefore yields a smallest feedback vertex set.",
        complexityRationale:
            "Each branch deletes one vertex, so at most 2^V subsets are visited, and each node spends O(V + E) finding a cycle and bounding, giving the stated exponential bound. Adjacency, recursion, and the stored set use O(V + E) space.",
        uses: [
            "Breaking dependency cycles in build and package systems",
            "Making deadlock-prone wait-for graphs acyclic",
            "Preprocessing for scheduling and topologically ordered execution",
        ],
        references: [
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on depth-first search",
            "Fulkerson, Feedback vertex sets and cyclically reducible graphs, 1965",
        ],
        workedExample:
            "For the cycle A to B to C to A plus the tail C to D to E to C, the two cycles share C. Deleting C breaks both at once, giving a feedback vertex set of size one, which is optimal because the first cycle alone already requires a deletion.",
    },
    id: "feedback-vertex-set",
    name: "Feedback Vertex Set",
    category: "graph",
    complexity: { time: "O(2^V * (V + E))", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B"],
            B: ["C", "A"],
            C: ["A", "D"],
            D: ["E"],
            E: ["C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with an empty deletion set and no banned vertices",
        "search for a directed cycle outside the deletion set",
        "if none exists, record the current set as a candidate",
        "pack vertex-disjoint cycles to bound further deletions",
        "prune when the bound cannot beat the best set",
        "for each removable vertex on the cycle, branch and recurse",
        "continue until all branches are explored",
        "report the smallest feedback vertex set",
    ],
};

export default module;
