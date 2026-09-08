/**
 * tree-serialize-deserialize.ts – level-order codec with "#" nulls.
 * BFS writes each node (missing children as #), then a second BFS
 * rebuilds the tree; equality of the two strings is the round-trip.
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
    };
    const ids = Array.isArray(t.ids) ? (t.ids as unknown[]).map(String) : ["A", "B", "C", "D"];
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
        yield emit({}, "Empty tree – serialized as an empty string.", 0, {
            serialized: "",
            roundTrip: true,
        });
        return;
    }

    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const id of ids) {
        const p = parent.get(id);
        if (p && kids.has(p)) kids.get(p)?.push(id);
    }
    for (const id of ids) kids.get(id)?.sort();
    const root = ids.find((id) => !parent.get(id)) ?? (ids[0] as string);

    // Serialize: BFS, first two sorted children as left/right, "#" for gaps.
    const tokens: string[] = [];
    const order: (string | null)[] = [root];
    let guard = ids.length * 3 + 5;
    while (order.length > 0 && guard-- > 0) {
        const v = order.shift() as string | null;
        if (v === null) {
            tokens.push("#");
            continue;
        }
        tokens.push(v);
        const [l, r] = kids.get(v) ?? [];
        order.push(l ?? null, r ?? null);
    }
    while (tokens[tokens.length - 1] === "#") tokens.pop();
    const serialized = tokens.join(",");

    // Deserialize: rebuild level by level from the token stream.
    const rebuilt = new Map<string, string | null>();
    const q: (string | null)[] = [];
    if (tokens.length > 0 && tokens[0] !== "#") {
        rebuilt.set(tokens[0] as string, null);
        q.push(tokens[0] as string);
    }
    let ti = 1;
    guard = tokens.length + 5;
    while (q.length > 0 && ti < tokens.length && guard-- > 0) {
        const v = q.shift() as string;
        for (let k = 0; k < 2 && ti < tokens.length; k += 1) {
            const tok = tokens[ti] as string;
            ti += 1;
            if (tok !== "#") {
                rebuilt.set(tok, v);
                q.push(tok);
            }
        }
    }
    const same =
        rebuilt.size === ids.length &&
        ids.every((id) => (rebuilt.get(id) ?? null) === (parent.get(id) ?? null));
    const levels: string[][] = [[root]];
    const seenLv = new Set([root]);
    for (;;) {
        const next: string[] = [];
        for (const v of levels[levels.length - 1] as string[]) {
            for (const c of kids.get(v) ?? []) {
                if (!seenLv.has(c)) {
                    seenLv.add(c);
                    next.push(c);
                }
            }
        }
        if (next.length === 0) break;
        levels.push(next);
    }

    yield emit(
        {},
        `Serializing ${ids.length} nodes level by level, "#" marks missing children.`,
        0,
    );
    step += 1;
    for (const lv of levels.slice(0, 9)) {
        const states: Record<string, EntityState> = {};
        for (const v of lv) states[v] = "comparing";
        for (const prev of levels.slice(0, levels.indexOf(lv)).flat()) states[prev] = "visited";
        yield emit(states, `Level [${lv.join(", ")}] written.`, 1);
        step += 1;
        if (step > 9) break;
    }
    yield emit(
        Object.fromEntries(ids.map((id) => [id, "visited" as EntityState])),
        `Serialized as "${serialized}".`,
        2,
        { serialized },
    );
    step += 1;
    const fstates: Record<string, EntityState> = {};
    for (const id of ids) fstates[id] = "sorted";
    yield emit(
        fstates,
        same
            ? `Deserialized back – strings match, round-trip holds.`
            : "Deserialized back – mismatch found.",
        3,
        { serialized, roundTrip: same },
    );
}

const module: AlgorithmModule = {
    id: "tree-serialize-deserialize",
    name: "Tree Serialize Deserialize",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B" },
        ids: ["A", "B", "C", "D"],
    },
    visualType: "tree",
    run,
};

export default module;
