/**
 * optimal-bst.ts – optimal binary search tree (DP over intervals).
 * cost[i][j] = weight(i,j) + min over roots r of outer costs.
 * Classic keys [10,12,20] freqs [34,8,50] give min cost 142, root 20.
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

function node(
    id: string,
    parent: string | null,
    freq: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `node-${id}`,
        type: "node" as const,
        label: `${id}(${freq})`,
        value: freq,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent === null ? "root" : `node-${parent}` },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { keys?: unknown; freq?: unknown } | null) ?? {};
    const keys = Array.isArray(t.keys) ? (t.keys as unknown[]).map(String) : ["10", "12", "20"];
    const freq = Array.isArray(t.freq) ? (t.freq as unknown[]).map(Number) : [34, 8, 50];
    const n = Math.min(keys.length, freq.length);

    let step = 0;
    const flat = (states: Record<string, EntityState>): VisualEntity[] =>
        keys.slice(0, n).map((k, i) => node(k, null, freq[i] as number, states[k] ?? "idle"));
    const emit = (
        ents: VisualEntity[],
        edges: Edge[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: ents,
        edges,
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (n === 0) {
        yield emit([], [], "No keys – empty optimal BST costs 0.", 0, { minCost: 0, root: "none" });
        return;
    }

    const sum = [0];
    for (let i = 0; i < n; i += 1) sum.push((sum[i] as number) + (freq[i] as number));
    const cost: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    const root: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        (cost[i] as number[])[i] = freq[i] as number;
        (root[i] as number[])[i] = i;
    }
    const intervals: { i: number; j: number }[] = [];
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len - 1 < n; i += 1) {
            const j = i + len - 1;
            const w = (sum[j + 1] as number) - (sum[i] as number);
            let best = Infinity;
            let br = i;
            for (let r = i; r <= j; r += 1) {
                const c =
                    (r > i ? ((cost[i] as number[])[r - 1] as number) : 0) +
                    (r < j ? ((cost[r + 1] as number[])[j] as number) : 0) +
                    w;
                if (c < best) {
                    best = c;
                    br = r;
                }
            }
            (cost[i] as number[])[j] = best;
            (root[i] as number[])[j] = br;
            intervals.push({ i, j });
        }
    }
    const minCost = n === 1 ? (freq[0] as number) : ((cost[0] as number[])[n - 1] as number);

    const par = new Map<string, string | null>();
    const grow = (i: number, j: number, p: string | null): void => {
        if (i > j) return;
        const r = (root[i] as number[])[j] as number;
        const k = keys[r] as string;
        par.set(k, p);
        grow(i, r - 1, k);
        grow(r + 1, j, k);
    };
    grow(0, n - 1, null);
    const treeEdges: Edge[] = [];
    for (const [k, p] of par) {
        if (p !== null)
            treeEdges.push({
                id: `edge-node-${p}-node-${k}`,
                sourceId: `node-${p}`,
                targetId: `node-${k}`,
                state: "idle",
                label: "",
                directed: false,
            });
    }

    yield emit(
        flat({}),
        [],
        `Keys ${keys.slice(0, n).join(", ")} with freqs ${freq.slice(0, n).join(", ")} – weighing intervals.`,
        0,
    );
    step += 1;
    yield emit(
        flat(Object.fromEntries(keys.slice(0, n).map((k) => [k, "visited" as EntityState]))),
        [],
        `Singletons cost their own freq: ${keys
            .slice(0, n)
            .map((k, i) => `${k}=${freq[i]}`)
            .join(", ")}.`,
        1,
    );
    step += 1;

    const show =
        intervals.length > 10
            ? intervals.filter((_, k) => k % Math.ceil(intervals.length / 8) === 0)
            : intervals;
    for (const { i, j } of show) {
        const r = (root[i] as number[])[j] as number;
        const states: Record<string, EntityState> = {};
        for (let k = i; k <= j; k += 1) states[keys[k] as string] = "visited";
        states[keys[r] as string] = "comparing";
        yield emit(
            flat(states),
            [],
            `Interval [${keys[i]}..${keys[j]}]: best root ${keys[r]}, cost ${(cost[i] as number[])[j]}.`,
            2,
        );
        step += 1;
        if (step > 12) break;
    }
    const rkey = keys[(root[0] as number[])[n - 1] as number] as string;
    const finalStates: Record<string, EntityState> = {};
    for (const k of keys.slice(0, n)) finalStates[k] = "sorted";
    finalStates[rkey] = "highlight";
    yield emit(
        keys
            .slice(0, n)
            .map((k, i) => node(k, par.get(k) ?? null, freq[i] as number, finalStates[k])),
        treeEdges,
        `Optimal BST costs ${minCost} with root ${rkey}.`,
        3,
        { minCost, root: rkey },
    );
}

const module: AlgorithmModule = {
    id: "optimal-bst",
    name: "Optimal BST",
    category: "tree",
    complexity: { time: "O(n³)", space: "O(n²)" },
    defaultInput: { keys: ["10", "12", "20"], freq: [34, 8, 50] },
    visualType: "tree",
    run,
};

export default module;
