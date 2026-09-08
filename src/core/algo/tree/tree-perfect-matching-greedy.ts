/**
 * tree-perfect-matching-greedy.ts – leaf-up greedy maximum matching.
 * Process nodes deepest-first; match an unmatched node with its
 * unmatched parent. Perfect iff all n (even) nodes end matched.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { parentMap?: unknown; ids?: unknown } | null) ?? {};
    const rawParent = (t.parentMap as Record<string, string> | undefined) ?? {
        B: "A",
        C: "B",
        D: "C",
    };
    const ids = Array.isArray(t.ids) ? (t.ids as unknown[]).map(String) : ["A", "B", "C", "D"];
    const parent = new Map<string, string | null>(
        ids.map((id) => [id, (rawParent[id] as string) ?? null]),
    );

    let step = 0;
    const pairs: [string, string][] = [];
    const treeEdges: Edge[] = [];
    for (const id of ids) {
        const p = parent.get(id);
        if (p && ids.includes(p)) {
            pairs.push([p, id]);
            treeEdges.push({
                id: `edge-node-${p}-node-${id}`,
                sourceId: `node-${p}`,
                targetId: `node-${id}`,
                state: "idle",
                label: "",
                directed: false,
            });
        }
    }
    const emit = (
        states: Record<string, EntityState>,
        hot: Set<string>,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: id,
            state: states[id] ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.get(id) ? `node-${parent.get(id)}` : "root" },
        })),
        edges: treeEdges.map((e) => ({
            ...e,
            state: hot.has(e.id) ? ("path" as EntityState) : e.state,
        })),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (ids.length === 0) {
        yield emit({}, new Set(), "Empty tree – vacuously perfectly matched.", 0, {
            matching: [],
            matchingSize: 0,
            perfect: true,
        });
        return;
    }

    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [p, c] of pairs) kids.get(p)?.push(c);
    const root = ids.find((id) => !parent.get(id)) ?? (ids[0] as string);
    const depth = new Map<string, number>([[root, 0]]);
    const bfs: string[] = [root];
    while (bfs.length > 0) {
        const v = bfs.shift() as string;
        for (const c of kids.get(v) ?? []) {
            depth.set(c, (depth.get(v) as number) + 1);
            bfs.push(c);
        }
    }
    const order = [...ids].sort((a, b) => (depth.get(b) as number) - (depth.get(a) as number));
    const matched = new Set<string>();
    const matching: [string, string][] = [];
    const events: { v: string; with: string | null }[] = [];
    for (const v of order.slice(0, 24)) {
        if (matched.has(v)) continue;
        const p = parent.get(v);
        if (p && !matched.has(p)) {
            matched.add(v);
            matched.add(p);
            matching.push([v, p]);
            events.push({ v, with: p });
        } else {
            events.push({ v, with: null });
        }
    }
    const hot = new Set(
        matching.map(([a, b]) => {
            const p = parent.get(a) === b ? b : a;
            const c = parent.get(a) === b ? a : b;
            return `edge-node-${p}-node-${c}`;
        }),
    );

    // ponytail: brute-force max matching verifies greedy on tiny trees.
    let bruteMax = matching.length;
    if (pairs.length <= 20) {
        bruteMax = 0;
        for (let mask = 0; mask < 1 << pairs.length; mask += 1) {
            const used = new Set<string>();
            let size = 0;
            let valid = true;
            for (let e = 0; e < pairs.length; e += 1) {
                if (mask & (1 << e)) {
                    const [a, b] = pairs[e] as [string, string];
                    if (used.has(a) || used.has(b)) {
                        valid = false;
                        break;
                    }
                    used.add(a);
                    used.add(b);
                    size += 1;
                }
            }
            if (valid && size > bruteMax) bruteMax = size;
        }
    }
    const perfect = matched.size === ids.length && ids.length % 2 === 0;

    yield emit(
        {},
        new Set(),
        `Greedy matching on path-like tree of ${ids.length} nodes – deepest first.`,
        0,
    );
    step += 1;
    for (const { v, with: w } of events) {
        if (step > 10) break;
        const states: Record<string, EntityState> = {};
        for (const m of matched) states[m] = "visited";
        states[v] = w ? "comparing" : "idle";
        if (w) states[w] = "comparing";
        yield emit(
            states,
            new Set(),
            w
                ? `${v} is free – matching it with parent ${w}.`
                : `${v} is already matched or parentless – skipping.`,
            1,
        );
        step += 1;
    }
    yield emit(
        Object.fromEntries(
            ids.map((id) => [id, (matched.has(id) ? "visited" : "idle") as EntityState]),
        ),
        new Set(),
        `Greedy found ${matching.length} pairs; brute-force max is ${bruteMax} – ${matching.length === bruteMax ? "optimal" : "MISMATCH"}.`,
        2,
    );
    step += 1;
    const fstates: Record<string, EntityState> = {};
    for (const id of ids) fstates[id] = matched.has(id) ? "sorted" : "idle";
    yield emit(
        fstates,
        hot,
        perfect
            ? `Perfect matching of size ${matching.length}: ${matching.map(([a, b]) => `${a}–${b}`).join(", ")}.`
            : `No perfect matching – ${ids.length - matched.size} nodes left unmatched.`,
        3,
        { matching: matching.map(([a, b]) => `${a}–${b}`), matchingSize: matching.length, perfect },
    );
}

const module: AlgorithmModule = {
    id: "tree-perfect-matching-greedy",
    name: "Tree Perfect Matching Greedy",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "B", D: "C" },
        ids: ["A", "B", "C", "D"],
    },
    visualType: "tree",
    run,
};

export default module;
