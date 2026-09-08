/**
 * threaded-binary-tree.ts – inorder-threaded binary tree.
 * Every null child link is replaced by a "thread" to the inorder
 * predecessor (left) or successor (right), so traversal needs no stack.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Edge = {
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
};

function node(id: string, parent: string | null, state: EntityState = "idle"): VisualEntity {
    return {
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: id,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent === null ? "root" : `node-${parent}` },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { values?: unknown } | null) ?? {};
    const values = Array.isArray(t.values)
        ? (t.values as unknown[]).map(String)
        : ["4", "2", "6", "1", "3", "5", "7"];

    let step = 0;
    const treeEdges: Edge[] = [];
    const parent = new Map<string, string | null>();
    values.forEach((v, i) => {
        const p = i === 0 ? null : (values[(i - 1) >> 1] as string);
        parent.set(v, p);
        if (p !== null) {
            treeEdges.push({
                id: `edge-node-${p}-node-${v}`,
                sourceId: `node-${p}`,
                targetId: `node-${v}`,
                state: "idle",
                label: "",
                directed: false,
            });
        }
    });
    const left = new Map<string, string | null>();
    const right = new Map<string, string | null>();
    values.forEach((v, i) => {
        left.set(v, values[2 * i + 1] !== undefined ? (values[2 * i + 1] as string) : null);
        right.set(v, values[2 * i + 2] !== undefined ? (values[2 * i + 2] as string) : null);
    });

    const inorder: string[] = [];
    const walk = (i: number): void => {
        if (i >= values.length) return;
        walk(2 * i + 1);
        inorder.push(values[i] as string);
        walk(2 * i + 2);
    };
    walk(0);

    const threads: { from: string; to: string | null; side: string }[] = [];
    inorder.forEach((v, i) => {
        if (left.get(v) === null)
            threads.push({ from: v, to: i > 0 ? (inorder[i - 1] as string) : null, side: "left" });
        if (right.get(v) === null)
            threads.push({
                from: v,
                to: i < inorder.length - 1 ? (inorder[i + 1] as string) : null,
                side: "right",
            });
    });

    const emit = (
        states: Record<string, EntityState>,
        threadCount: number,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: values.map((v) => node(v, parent.get(v) ?? null, states[v] ?? "idle")),
        edges: [
            ...treeEdges,
            ...threads.slice(0, threadCount).flatMap((th, k) =>
                th.to === null
                    ? []
                    : [
                          {
                              id: `thread-${k}`,
                              sourceId: `node-${th.from}`,
                              targetId: `node-${th.to}`,
                              label: "",
                              state: "path" as EntityState,
                              directed: false,
                          },
                      ],
            ),
        ],
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (values.length === 0) {
        yield emit({}, 0, "Empty tree – no threads to create.", 0, { threads: 0, inorder: [] });
        return;
    }

    yield emit(
        {},
        0,
        `Complete tree on ${values.join(", ")} – ${threads.length} null links will become threads.`,
        0,
    );
    step += 1;
    yield emit(
        Object.fromEntries(inorder.map((v) => [v, "visited" as EntityState])),
        threads.length,
        `Inorder order is ${inorder.join(" → ")}; threads follow this order.`,
        1,
        { inorder },
    );
    step += 1;

    const order = [...threads].sort((a, b) => values.indexOf(a.from) - values.indexOf(b.from));
    const batch = Math.max(1, Math.ceil(order.length / 9));
    for (let end = batch; end < order.length; end += batch) {
        const states: Record<string, EntityState> = {};
        for (const th of order.slice(0, end)) states[th.from] = "visited";
        states[(order[end - 1] as { from: string }).from] = "comparing";
        const th = order[end - 1] as { from: string; to: string | null; side: string };
        yield emit(
            states,
            end,
            th.to === null
                ? `${th.from}'s null ${th.side} link threads to the header (no ${th.side === "left" ? "predecessor" : "successor"}).`
                : `${th.from}'s null ${th.side} link threads to ${th.to}.`,
            2,
        );
        step += 1;
    }
    const states: Record<string, EntityState> = {};
    for (const v of values) states[v] = "sorted";
    yield emit(
        states,
        threads.length,
        `Threaded – all ${threads.length} null links replaced; inorder walk needs no stack.`,
        3,
        { threads: threads.length, inorder },
    );
}

const module: AlgorithmModule = {
    id: "threaded-binary-tree",
    name: "Threaded Binary Tree",
    category: "tree",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: ["4", "2", "6", "1", "3", "5", "7"] },
    visualType: "tree",
    run,
};

export default module;
