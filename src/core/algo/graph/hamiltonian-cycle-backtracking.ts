/**
 * hamiltonian-cycle-backtracking.ts – Hamiltonian Cycle (Backtracking)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Hamiltonian cycle visits every vertex exactly once and returns to the
 * start. Backtracking builds the path step by step: extend it with an
 * unvisited neighbor of the last vertex, and when no neighbor is free,
 * backtrack to try another branch. If the path ever covers all vertices and
 * the last one links back to the start, the cycle closes. The square
 * A→B→C→D→A closes with no backtracking needed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V!) worst case – exponential backtracking search
 *   Space: O(V) for the current path
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Path vertices are YELLOW (comparing); tried edges BLUE (active).
 *   - Backtracked vertices revert to gray; the closed cycle is GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - NP-complete: no known polynomial algorithm.
 *   - Pruning (dead-end detection) is what separates fast from slow solvers.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]>; start?: string } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "D"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C", "A"],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const start =
        task.start && adjacency[task.start] !== undefined ? task.start : (labels[0] as string);
    const path = [start];
    setN(start, "comparing");
    yield snap(`Backtracking Hamiltonian cycle from ${start}: extend or backtrack.`, 0, {});
    step += 1;
    let done = false;
    let guard = 0;
    while (!done && guard < 40) {
        guard += 1;
        const last = path[path.length - 1] as string;
        const next = (adjacency[last] ?? []).find((v) => !path.includes(v));
        if (next !== undefined) {
            path.push(next);
            setE(last, next, "active");
            setN(next, "comparing");
            yield snap(`Place ${next}: path ${path.join("→")}.`, 1, { placed: path.length });
            step += 1;
            if (path.length === labels.length) {
                if ((adjacency[next] ?? []).includes(start)) {
                    setE(next, start, "path");
                    for (const p of path) setN(p, "path");
                    yield snap(
                        `Cycle closed: ${[...path, start].join("→")} visits every vertex once.`,
                        2,
                        { length: path.length + 1 },
                    );
                    step += 1;
                    done = true;
                }
            }
        } else if (path.length === labels.length) {
            break;
        } else {
            const drop = path.pop() as string;
            setN(drop, "unvisited");
            const prev = path[path.length - 1];
            if (prev !== undefined) setE(prev, drop, "idle");
            yield snap(`Dead end at ${drop}: backtrack to ${path.join("→") || "∅"}.`, 2, {
                placed: path.length,
            });
            step += 1;
            if (path.length === 0) break;
        }
    }
    if (!done) {
        clr();
        yield snap("No Hamiltonian cycle exists from this start.", 4, {});
    }
}

const module: AlgorithmModule = {
    id: "hamiltonian-cycle-backtracking",
    name: "Hamiltonian Cycle (Backtracking)",
    category: "graph",
    complexity: { time: "O(V!)", space: "O(V)" },
    defaultInput: {
        graph: { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] },
        start: "A",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "path ← [start]",
        "extend the path with an unvisited neighbor of its last vertex",
        "dead end: backtrack; full path plus an edge home: close the cycle",
        "repeat until a cycle closes or all options are exhausted",
        "done: a Hamiltonian cycle, or proof that none exists",
    ],
};

export default module;
