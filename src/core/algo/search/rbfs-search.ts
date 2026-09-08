/**
 * rbfs-search.ts – Recursive Best-First Search
 *
 * Recurses down the best child while tracking each sibling's f-value
 * as the backtrack limit. Tiny explicit graph; the goal goes green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const NODES = ["A", "B", "C", "D", "G"];
const EDGES: Array<[string, string, number]> = [
    ["A", "B", 1],
    ["A", "C", 4],
    ["B", "D", 2],
    ["C", "D", 1],
    ["D", "G", 3],
];
const H: Record<string, number> = { A: 5, B: 3, C: 4, D: 2, G: 0 };

function makeNodes(states: Map<string, EntityState> = new Map()): VisualEntity[] {
    return NODES.map((id, i) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: `${id}(h=${H[id]})`,
        value: i,
        state: states.get(id) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { name: id, heuristic: H[id] },
    }));
}

function neighbors(id: string): Array<[string, number]> {
    return EDGES.filter(([from]) => from === id).map(
        ([, to, cost]) => [to, cost] as [string, number],
    );
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: string; goal?: string } | null) ?? {};
    const start = typeof task.start === "string" && NODES.includes(task.start) ? task.start : "A";
    const goal = typeof task.goal === "string" && NODES.includes(task.goal) ? task.goal : "G";
    let step = 0;
    let calls = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(new Map([[start, "comparing"]])),
        edges: [],
        description: `RBFS from ${start} to ${goal} with limit ∞.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { calls, start, goal },
    };
    step += 1;
    type Frame = {
        node: string;
        g: number;
        limit: number;
        childIdx: number;
        kids: Array<[string, number]>;
    };
    const stack: Frame[] = [
        { node: start, g: 0, limit: Number.POSITIVE_INFINITY, childIdx: 0, kids: neighbors(start) },
    ];
    const path = [start];
    while (stack.length > 0 && step < 13) {
        const top = stack[stack.length - 1] as Frame;
        calls += 1;
        if (top.node === goal) {
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[goal, "sorted"]])),
                edges: [],
                description: `Goal ${goal} reached with cost ${top.g}. Path: ${path.join("→")}.`,
                codeLineNumber: 3,
                layout: "graph",
                meta: { calls, start, goal, cost: top.g },
            };
            return;
        }
        if (top.childIdx >= top.kids.length) {
            stack.pop();
            path.pop();
            yield {
                stepNumber: step,
                entities: makeNodes(new Map([[top.node, "highlight"]])),
                edges: [],
                description: `Backtracking from ${top.node} past limit ${top.limit === Number.POSITIVE_INFINITY ? "∞" : top.limit}.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { calls, start, goal },
            };
            step += 1;
            continue;
        }
        const [nb, cost] = top.kids[top.childIdx] as [string, number];
        top.childIdx += 1;
        const f = top.g + cost + (H[nb] as number);
        const alt =
            top.childIdx < top.kids.length
                ? top.g +
                  (top.kids[top.childIdx] as [string, number])[1] +
                  (H[(top.kids[top.childIdx] as [string, number])[0]] as number)
                : top.limit;
        const childLimit = Math.min(top.limit, alt);
        yield {
            stepNumber: step,
            entities: makeNodes(
                new Map([
                    [nb, "comparing"],
                    [top.node, "highlight"],
                ] as Array<[string, EntityState]>),
            ),
            edges: [],
            description: `Recursing into ${nb} (f=${f}) with limit ${childLimit === Number.POSITIVE_INFINITY ? "∞" : childLimit}.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { calls, start, goal },
        };
        step += 1;
        if (f > top.limit) continue;
        stack.push({
            node: nb,
            g: top.g + cost,
            limit: childLimit,
            childIdx: 0,
            kids: neighbors(nb),
        });
        path.push(nb);
    }
    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: [],
        description: `Goal ${goal} was not reached.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { calls, start, goal },
    };
}

const module: AlgorithmModule = {
    id: "rbfs-search",
    name: "RBFS Search",
    category: "searching",
    complexity: { time: "O(b^d)", space: "O(d)" },
    defaultInput: { start: "A", goal: "G" },
    visualType: "graph",
    run,
};

export default module;
