/**
 * tree-k-dominating-set.ts – minimum k-dominating set (k=1 default).
 * Every node must sit within distance k of a chosen node.
 * Brute-forced tiny: {B, C} dominates all 5 default nodes.
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
    const t = (input as { parentMap?: unknown; ids?: unknown; k?: unknown } | null) ?? {};
    const rawParent = (t.parentMap as Record<string, string> | undefined) ?? {
        B: "A",
        C: "A",
        D: "B",
        E: "C",
    };
    const ids = Array.isArray(t.ids) ? (t.ids as unknown[]).map(String) : ["A", "B", "C", "D", "E"];
    const k = typeof t.k === "number" && t.k >= 0 ? Math.floor(t.k) : 1;
    const parent = new Map<string, string | null>(
        ids.map((id) => [id, (rawParent[id] as string) ?? null]),
    );

    let step = 0;
    const treeEdges: Edge[] = [];
    const adj = new Map(ids.map((id) => [id, [] as string[]]));
    for (const id of ids) {
        const p = parent.get(id);
        if (p && ids.includes(p)) {
            treeEdges.push({
                id: `edge-node-${p}-node-${id}`,
                sourceId: `node-${p}`,
                targetId: `node-${id}`,
                state: "idle",
                label: "",
                directed: false,
            });
            adj.get(p)?.push(id);
            adj.get(id)?.push(p as string);
        }
    }
    const emit = (
        states: Record<string, EntityState>,
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
        edges: treeEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (ids.length === 0) {
        yield emit({}, "Empty tree – dominating set is empty.", 0, { k, minSize: 0, set: [] });
        return;
    }

    const dist = new Map<string, Map<string, number>>();
    for (const s of ids) {
        const d = new Map([[s, 0]]);
        const q = [s];
        while (q.length > 0) {
            const v = q.shift() as string;
            for (const nb of adj.get(v) ?? []) {
                if (!d.has(nb)) {
                    d.set(nb, (d.get(v) as number) + 1);
                    q.push(nb);
                }
            }
        }
        dist.set(s, d);
    }
    const dominates = (chosen: string[]): boolean =>
        ids.every((v) => chosen.some((c) => (dist.get(c)?.get(v) as number) <= k));

    // ponytail: brute force by growing size is exact for tiny trees.
    let winner: string[] = [...ids];
    const tried: string[][] = [];
    outer: for (let size = 1; size <= Math.min(ids.length, 12); size += 1) {
        const idx = Array.from({ length: size }, (_, i) => i);
        for (;;) {
            const cand = idx.map((i) => ids[i] as string);
            if (dominates(cand)) {
                winner = cand;
                break outer;
            }
            if (tried.length < 3) tried.push(cand);
            let p = size - 1;
            while (p >= 0 && (idx[p] as number) === ids.length - size + p) p -= 1;
            if (p < 0) break;
            (idx[p] as number) += 1;
            for (let q = p + 1; q < size; q += 1) idx[q] = (idx[q - 1] as number) + 1;
        }
    }

    yield emit(
        {},
        `${k}-dominating set on ${ids.length} nodes – every node within distance ${k} of the set.`,
        0,
    );
    step += 1;
    for (const cand of tried.slice(0, 3)) {
        const states: Record<string, EntityState> = {};
        for (const c of cand) states[c] = "comparing";
        yield emit(
            states,
            `{${cand.join(", ")}} leaves ${ids.filter((v) => !cand.some((c) => (dist.get(c)?.get(v) as number) <= k)).join(", ")} uncovered – rejected.`,
            1,
        );
        step += 1;
    }
    const wstates: Record<string, EntityState> = {};
    for (const c of winner) wstates[c] = "comparing";
    yield emit(
        wstates,
        `{${winner.join(", ")}} dominates everything – trying nothing smaller worked.`,
        2,
    );
    step += 1;
    const fstates: Record<string, EntityState> = {};
    for (const id of ids) fstates[id] = winner.includes(id) ? "highlight" : "visited";
    yield emit(
        fstates,
        `Minimum ${k}-dominating set has size ${winner.length}: {${winner.join(", ")}}.`,
        3,
        { k, minSize: winner.length, set: winner },
    );
}

const module: AlgorithmModule = {
    id: "tree-k-dominating-set",
    name: "Tree K-Dominating Set",
    category: "tree",
    complexity: { time: "O(2^n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "C" },
        ids: ["A", "B", "C", "D", "E"],
        k: 1,
    },
    visualType: "tree",
    run,
};

export default module;
