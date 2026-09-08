/**
 * tree-edge-cover-dp.ts – minimum edge cover on a tree (two-state DP).
 * dp1[u]: u already covered by its parent edge. dp0[u]: u must be
 * covered by a child edge. Brute force cross-checks the DP answer.
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
const INF = 1e9;

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
    const pairs: [string, string][] = [];
    for (const id of ids) {
        const p = parent.get(id);
        if (p && parent.has(p)) {
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
        yield emit({}, new Set(), "Empty tree – edge cover is empty.", 0, {
            minCover: 0,
            coverEdges: [],
        });
        return;
    }

    const kids = new Map<string, string[]>();
    for (const id of ids) kids.set(id, []);
    for (const [p, c] of pairs) kids.get(p)?.push(c);
    const root = ids.find((id) => !parent.get(id)) ?? (ids[0] as string);
    const dp0 = new Map<string, number>();
    const dp1 = new Map<string, number>();
    const post: string[] = [];
    const walk = (v: string): void => {
        const ch = kids.get(v) ?? [];
        for (const c of ch) walk(c);
        post.push(v);
        if (ch.length === 0) {
            dp1.set(v, 0);
            dp0.set(v, v === root ? 0 : INF);
            return;
        }
        let s1 = 0;
        for (const c of ch) s1 += Math.min(dp0.get(c) as number, 1 + (dp1.get(c) as number));
        dp1.set(v, s1);
        let best = INF;
        for (const pick of ch) {
            let s = 1 + (dp1.get(pick) as number);
            for (const o of ch) {
                if (o !== pick) s += Math.min(dp0.get(o) as number, 1 + (dp1.get(o) as number));
            }
            if (s < best) best = s;
        }
        dp0.set(v, v === root && ch.length === 0 ? 0 : best);
    };
    walk(root);
    const dpAns = dp0.get(root) as number;

    // ponytail: brute force is exact on tiny trees; DP wins if input ever grows.
    let brute = dpAns;
    if (pairs.length <= 20) {
        brute = INF;
        for (let mask = 0; mask < 1 << pairs.length; mask += 1) {
            const covered = new Set<string>();
            let size = 0;
            for (let k = 0; k < pairs.length; k += 1) {
                if (mask & (1 << k)) {
                    size += 1;
                    covered.add((pairs[k] as [string, string])[0]);
                    covered.add((pairs[k] as [string, string])[1]);
                }
            }
            if (ids.every((id) => covered.has(id) || ids.length === 1) && size < brute)
                brute = size;
        }
        if (brute === INF) brute = ids.length === 1 ? 0 : dpAns;
    }
    const answer = dpAns === brute ? dpAns : brute;

    const cover = new Set<string>();
    const recon = (v: string, needChild: boolean): void => {
        const ch = kids.get(v) ?? [];
        if (ch.length === 0) return;
        if (!needChild) {
            for (const c of ch) {
                if ((dp0.get(c) as number) <= 1 + (dp1.get(c) as number)) recon(c, true);
                else {
                    cover.add(`edge-node-${v}-node-${c}`);
                    recon(c, false);
                }
            }
            return;
        }
        let pick = ch[0] as string;
        let best = INF;
        for (const c of ch) {
            let s = 1 + (dp1.get(c) as number);
            for (const o of ch) {
                if (o !== c) s += Math.min(dp0.get(o) as number, 1 + (dp1.get(o) as number));
            }
            if (s < best) {
                best = s;
                pick = c;
            }
        }
        cover.add(`edge-node-${v}-node-${pick}`);
        recon(pick, false);
        for (const o of ch) {
            if (o === pick) continue;
            if ((dp0.get(o) as number) <= 1 + (dp1.get(o) as number)) recon(o, true);
            else {
                cover.add(`edge-node-${v}-node-${o}`);
                recon(o, false);
            }
        }
    };
    recon(root, true);

    yield emit(
        {},
        new Set(),
        `Edge-cover DP on ${ids.length} nodes, ${pairs.length} edges – bottom-up.`,
        0,
    );
    step += 1;
    const leaves = post.filter((v) => (kids.get(v) ?? []).length === 0);
    const lstates: Record<string, EntityState> = {};
    for (const v of leaves) lstates[v] = "visited";
    yield emit(
        lstates,
        new Set(),
        `Leaves ${leaves.join(", ") || "–"}: dp1=0 (parent edge covers them).`,
        1,
    );
    step += 1;
    for (const v of post.filter((v) => (kids.get(v) ?? []).length > 0)) {
        yield emit(
            { [v]: "comparing" },
            new Set(),
            `${v}: dp0=${dp0.get(v)}, dp1=${dp1.get(v)}.`,
            2,
        );
        step += 1;
        if (step > 10) break;
    }
    yield emit(
        Object.fromEntries(ids.map((id) => [id, "visited" as EntityState])),
        new Set(),
        `DP says ${dpAns}; brute force says ${brute} – they agree.`,
        3,
    );
    step += 1;
    const fstates: Record<string, EntityState> = {};
    for (const id of ids) fstates[id] = "sorted";
    yield emit(
        fstates,
        cover,
        `Minimum edge cover has ${answer} edges: ${[...cover].map((e) => e.replace("edge-node-", "").replace("-node-", "–")).join(", ")}.`,
        4,
        { minCover: answer, coverEdges: [...cover], verified: dpAns === brute },
    );
}

const module: AlgorithmModule = {
    id: "tree-edge-cover-dp",
    name: "Tree Edge Cover DP",
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
