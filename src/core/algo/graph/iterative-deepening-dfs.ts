/**
 * iterative-deepening-dfs.ts – Iterative Deepening DFS
 *
 * Depth-limited DFS rerun with limits 0,1,2,…: BFS-like shallowest-goal
 * guarantee with only O(d) stack memory. Limit ring is highlight.
 * Time: O(b^d) Space: O(d)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, string[]>; start?: string; target?: string } | null) ??
        {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["D"],
        C: ["E"],
        D: [],
        E: [],
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
    const target = task.target ?? "E";
    yield snap(`IDDFS from ${start} seeking ${target}: grow the depth limit 0, 1, 2, …`, 0, {
        limit: 0,
    });
    step += 1;
    let found: string[] | null = null;
    for (let limit = 0; limit <= labels.length && !found; limit += 1) {
        clr();
        setN(start, "highlight");
        yield snap(`Depth limit ${limit} – probe from ${start}.`, 1, { limit });
        step += 1;
        const stack: Array<{ v: string; depth: number; path: string[] }> = [
            { v: start, depth: 0, path: [start] },
        ];
        while (stack.length > 0 && !found) {
            const top = stack.pop();
            if (!top) break;
            clr();
            for (const p of top.path) setN(p, "comparing");
            setN(top.v, "highlight");
            yield snap(`Visiting ${top.v} at depth ${top.depth} (path ${top.path.join("→")}).`, 2, {
                limit,
                depth: top.depth,
            });
            step += 1;
            if (top.v === target) {
                found = top.path;
                break;
            }
            if (top.depth < limit) {
                for (const nb of [...(adjacency[top.v] ?? [])].reverse()) {
                    if (!top.path.includes(nb))
                        stack.push({ v: nb, depth: top.depth + 1, path: [...top.path, nb] });
                }
            }
        }
        if (found) break;
        if (limit >= labels.length) break;
    }
    clr();
    if (found) {
        for (const p of found) setN(p, "path");
        yield snap(`Found ${target} at depth ${found.length - 1} via ${found.join("→")}.`, 3, {
            depth: found.length - 1,
        });
    } else {
        yield snap(`${target} unreachable from ${start} at any depth.`, 3, {});
    }
}

const module: AlgorithmModule = {
    id: "iterative-deepening-dfs",
    name: "Iterative Deepening DFS",
    category: "graph",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: {
        graph: { A: ["B", "C"], B: ["D"], C: ["E"], D: [], E: [] },
        start: "A",
        target: "E",
    },
    visualType: "graph",
    run,
};

export default module;
