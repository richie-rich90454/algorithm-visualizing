/**
 * tree-path-cover.ts – minimum vertex-disjoint path cover of a tree.
 * Kept edges must form disjoint paths (max degree ≤ 2, acyclic for free
 * in a tree), so min paths = n − max keepable edges (brute-forced tiny).
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
        C: "A",
        D: "B",
        E: "B",
    };
    const ids = Array.isArray(t.ids) ? (t.ids as unknown[]).map(String) : ["A", "B", "C", "D", "E"];
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
        yield emit({}, new Set(), "Empty tree – path cover is empty.", 0, {
            minPaths: 0,
            paths: [],
        });
        return;
    }

    // ponytail: brute force over edge subsets is exact for tiny trees.
    const m = pairs.length;
    let bestMask = 0;
    let bestKept = -1;
    const order: number[] = Array.from({ length: 1 << Math.min(m, 20) }, (_, k) => k).sort(
        (a, b) =>
            pairs.filter((_, k) => b & (1 << k)).length -
            pairs.filter((_, k) => a & (1 << k)).length,
    );
    for (const mask of order) {
        const deg = new Map(ids.map((id) => [id, 0]));
        for (let k = 0; k < m; k += 1) {
            if (mask & (1 << k)) {
                const [u, v] = pairs[k] as [string, string];
                deg.set(u, (deg.get(u) as number) + 1);
                deg.set(v, (deg.get(v) as number) + 1);
            }
        }
        if ([...deg.values()].every((d) => d <= 2)) {
            bestMask = mask;
            bestKept = pairs.filter((_, k) => mask & (1 << k)).length;
            break;
        }
    }
    const adj = new Map(ids.map((id) => [id, [] as string[]]));
    for (let k = 0; k < m; k += 1) {
        if (bestMask & (1 << k)) {
            const [u, v] = pairs[k] as [string, string];
            adj.get(u)?.push(v);
            adj.get(v)?.push(u);
        }
    }
    const seen = new Set<string>();
    const paths: string[][] = [];
    for (const id of ids) {
        if (seen.has(id)) continue;
        const comp: string[] = [];
        const stack = [id];
        seen.add(id);
        while (stack.length > 0) {
            const v = stack.pop() as string;
            comp.push(v);
            for (const nb of adj.get(v) ?? []) {
                if (!seen.has(nb)) {
                    seen.add(nb);
                    stack.push(nb);
                }
            }
        }
        let end = comp.find((v) => (adj.get(v) ?? []).length <= 1) ?? (comp[0] as string);
        const path = [end];
        let prev = "";
        for (;;) {
            const nx = (adj.get(end) ?? []).find((x) => x !== prev);
            if (!nx) break;
            prev = end;
            end = nx;
            path.push(end);
        }
        paths.push(path);
    }
    const minPaths = paths.length;
    const hot = new Set<string>();
    for (let k = 0; k < m; k += 1) {
        if (bestMask & (1 << k)) {
            const [u, v] = pairs[k] as [string, string];
            hot.add(`edge-node-${u}-node-${v}`);
        }
    }

    yield emit(
        {},
        new Set(),
        `Path cover on ${ids.length} nodes – kept edges must leave max degree ≤ 2.`,
        0,
    );
    step += 1;
    const hub = ids.find(
        (id) =>
            (adj.get(id) ?? []).length > 0 &&
            ids.filter((o) =>
                pairs.some(([a, b]) => (a === id && b === o) || (b === id && a === o)),
            ).length > 2,
    );
    yield emit(
        hub ? { [hub]: "comparing" } : {},
        new Set(),
        hub
            ? `${hub} joins 3+ tree edges, so one spanning path is impossible – at least 2 paths needed.`
            : "Searching edge subsets from largest down; first valid subset wins.",
        1,
    );
    step += 1;
    const shown = paths.slice(0, 8);
    for (let i = 0; i < shown.length; i += 1) {
        const states: Record<string, EntityState> = {};
        for (const v of shown[i] as string[]) states[v] = "comparing";
        for (const p of paths.slice(0, i)) {
            for (const v of p) states[v] = "visited";
        }
        yield emit(states, new Set(), `Path ${i + 1}: ${(shown[i] as string[]).join(" → ")}.`, 2);
        step += 1;
        if (step > 11) break;
    }
    const fstates: Record<string, EntityState> = {};
    for (const id of ids) fstates[id] = "sorted";
    yield emit(
        fstates,
        hot,
        `Minimum path cover uses ${minPaths} paths, keeping ${bestKept} of ${m} edges.`,
        3,
        { minPaths, paths: paths.map((p) => p.join("→")), maxKeptEdges: bestKept },
    );
}

const module: AlgorithmModule = {
    id: "tree-path-cover",
    name: "Tree Path Cover",
    category: "tree",
    complexity: { time: "O(2^m)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B" },
        ids: ["A", "B", "C", "D", "E"],
    },
    visualType: "tree",
    run,
};

export default module;
