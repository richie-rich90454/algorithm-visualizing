/**
 * tree-steiner-subtree.ts – minimal subtree spanning given terminals.
 * Union the root-ward paths of all terminals; prune the rest.
 * Terminals D,E,G keep 7 nodes and drop leaf H.
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
    const t = (input as { parentMap?: unknown; ids?: unknown; terminals?: unknown } | null) ?? {};
    const rawParent = (t.parentMap as Record<string, string> | undefined) ?? {
        B: "A",
        C: "A",
        D: "B",
        E: "B",
        F: "C",
        G: "F",
        H: "C",
    };
    const ids = Array.isArray(t.ids)
        ? (t.ids as unknown[]).map(String)
        : ["A", "B", "C", "D", "E", "F", "G", "H"];
    const terminals = Array.isArray(t.terminals)
        ? (t.terminals as unknown[]).map(String).filter((x) => ids.includes(x))
        : ["D", "E", "G"];
    const parent = new Map<string, string | null>(
        ids.map((id) => [id, (rawParent[id] as string) ?? null]),
    );

    let step = 0;
    const treeEdges: Edge[] = [];
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

    if (ids.length === 0 || terminals.length === 0) {
        yield emit({}, new Set(), "No terminals – Steiner subtree is empty.", 0, {
            terminals,
            steinerNodes: [],
            steinerEdges: 0,
        });
        return;
    }

    const chain = (v: string): string[] => {
        const out: string[] = [];
        let cur: string | null | undefined = v;
        let guard = ids.length + 1;
        while (cur && guard-- > 0) {
            out.push(cur);
            cur = parent.get(cur);
        }
        return out;
    };
    const kept = new Set<string>();
    const steps: { term: string; added: string[] }[] = [];
    for (const term of terminals.slice(0, 10)) {
        const added = chain(term).filter((v) => !kept.has(v));
        for (const v of chain(term)) kept.add(v);
        steps.push({ term, added });
    }
    const hot = new Set<string>();
    for (const id of kept) {
        const p = parent.get(id);
        if (p && kept.has(p)) hot.add(`edge-node-${p}-node-${id}`);
    }
    const pruned = ids.filter((id) => !kept.has(id));

    const tstates: Record<string, EntityState> = {};
    for (const x of terminals) tstates[x] = "highlight";
    yield emit(tstates, new Set(), `Terminals to connect: ${terminals.join(", ")}.`, 0);
    step += 1;
    for (const { term, added } of steps) {
        const states: Record<string, EntityState> = {};
        for (const v of kept) states[v] = "visited";
        for (const v of added) states[v] = "comparing";
        states[term] = "highlight";
        yield emit(
            states,
            new Set(),
            added.length > 0
                ? `Terminal ${term} pulls in ${added.join(", ")} along its root-ward path.`
                : `Terminal ${term} is already connected – nothing new.`,
            1,
        );
        step += 1;
        if (step > 10) break;
    }
    const pstates: Record<string, EntityState> = {};
    for (const v of kept) pstates[v] = "visited";
    yield emit(
        pstates,
        new Set(),
        pruned.length > 0
            ? `Pruning ${pruned.join(", ")} – off every terminal-to-terminal path.`
            : "Every node serves a terminal – nothing to prune.",
        2,
    );
    step += 1;
    const fstates: Record<string, EntityState> = {};
    for (const id of ids)
        fstates[id] = kept.has(id) ? (terminals.includes(id) ? "highlight" : "path") : "idle";
    yield emit(
        fstates,
        hot,
        `Steiner subtree keeps ${kept.size} nodes and ${hot.size} edges for ${terminals.length} terminals.`,
        3,
        { terminals, steinerNodes: [...kept], steinerEdges: hot.size },
    );
}

const module: AlgorithmModule = {
    id: "tree-steiner-subtree",
    name: "Tree Steiner Subtree",
    category: "tree",
    complexity: { time: "O(t·h)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "F", H: "C" },
        ids: ["A", "B", "C", "D", "E", "F", "G", "H"],
        terminals: ["D", "E", "G"],
    },
    visualType: "tree",
    run,
};

export default module;
