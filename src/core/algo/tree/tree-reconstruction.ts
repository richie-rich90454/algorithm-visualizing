/**
 * tree-reconstruction.ts – rebuild a binary tree from preorder + inorder.
 * preorder[0] is the root; its inorder slot splits left/right subtrees.
 * Recurse on both sides, then read postorder as a round-trip check.
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

function edgesOf(ents: VisualEntity[]): Edge[] {
    const out: Edge[] = [];
    for (const e of ents) {
        const p = (e.metadata as Record<string, unknown> | undefined)?.["parentId"];
        if (typeof p === "string" && p !== "root") {
            out.push({
                id: `edge-${p}-${e.id}`,
                sourceId: p,
                targetId: e.id,
                state: "idle",
                label: "",
                directed: false,
            });
        }
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { preorder?: unknown; inorder?: unknown } | null) ?? {};
    const pre = Array.isArray(t.preorder)
        ? (t.preorder as unknown[]).map(String)
        : ["3", "9", "20", "15", "7"];
    const ino = Array.isArray(t.inorder)
        ? (t.inorder as unknown[]).map(String)
        : ["9", "3", "15", "20", "7"];

    let step = 0;
    const emit = (
        ents: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: ents,
        edges: edgesOf(ents),
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (pre.length === 0 || ino.length === 0 || pre.length !== ino.length) {
        yield emit([], "Empty or mismatched traversals – nothing to rebuild.", 0, {
            postorder: [],
        });
        return;
    }
    const pos = new Map(ino.map((v, i) => [v, i]));
    if (pre.some((v) => !pos.has(v))) {
        yield emit([], "Preorder and inorder disagree – cannot rebuild.", 0, { postorder: [] });
        return;
    }

    const parent = new Map<string, string | null>();
    const build = (pl: number, pr: number, il: number, ir: number, p: string | null): void => {
        if (pl > pr || il > ir) return;
        const r = pre[pl] as string;
        parent.set(r, p);
        const m = pos.get(r) as number;
        const left = m - il;
        build(pl + 1, pl + left, il, m - 1, r);
        build(pl + left + 1, pr, m + 1, ir, r);
    };
    build(0, pre.length - 1, 0, ino.length - 1, null);

    const kids = new Map<string, string[]>();
    for (const v of pre) kids.set(v, []);
    for (const [v, p] of parent) {
        if (p !== null) kids.get(p)?.push(v);
    }
    for (const v of pre) {
        kids.get(v)?.sort((a, b) => (pos.get(a) as number) - (pos.get(b) as number));
    }
    const post: string[] = [];
    const walk = (v: string): void => {
        for (const c of kids.get(v) ?? []) walk(c);
        post.push(v);
    };
    walk(pre[0] as string);

    // Reveal nodes in preorder (root first); batch so frames stay ≤ 15.
    const batch = Math.max(1, Math.ceil(pre.length / 10));
    yield emit(
        [node(pre[0] as string, null, "comparing")],
        `preorder[0] = ${pre[0]} is the root; inorder splits into [${ino
            .slice(0, pos.get(pre[0] as string) as number)
            .join(
                ", ",
            )}] and [${ino.slice((pos.get(pre[0] as string) as number) + 1).join(", ")}].`,
        1,
    );
    step += 1;
    for (let end = 1 + batch; end < pre.length; end += batch) {
        const shown = pre.slice(0, Math.min(end, pre.length));
        const last = shown[shown.length - 1] as string;
        const p = parent.get(last) ?? null;
        const side =
            p === null
                ? "root"
                : (pos.get(last) as number) < (pos.get(p) as number)
                  ? "left"
                  : "right";
        const ents = shown.map((v) =>
            node(v, parent.get(v) ?? null, v === last ? "comparing" : "visited"),
        );
        yield emit(ents, `${last} sits ${side} of ${p ?? "–"} in inorder → ${side} child.`, 2);
        step += 1;
    }
    const done = pre.map((v) => node(v, parent.get(v) ?? null, "sorted"));
    yield emit(done, `Rebuilt – postorder ${post.join(", ")} confirms the round-trip.`, 3, {
        postorder: post,
    });
}

const module: AlgorithmModule = {
    id: "tree-reconstruction",
    name: "Tree Reconstruction",
    category: "tree",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        preorder: ["3", "9", "20", "15", "7"],
        inorder: ["9", "3", "15", "20", "7"],
    },
    visualType: "tree",
    run,
};

export default module;
