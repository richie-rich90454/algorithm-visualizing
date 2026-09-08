/**
 * merkle-tree-proof.ts – Merkle Tree Inclusion Proof.
 * Leaves a,b,c,d hash (djb2) up to one root; proving leaf "c" needs
 * only siblings h(d) and h(ab) — O(log n) hashes re-derive the root.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function h(s: string): string {
    let x = 5381;
    for (const ch of s) x = ((x * 33) ^ ch.charCodeAt(0)) >>> 0;
    return x.toString(16).padStart(8, "0");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { leaves?: string[]; prove?: number } | null) ?? {};
    const leaves =
        Array.isArray(cfg.leaves) && cfg.leaves.length > 0
            ? (cfg.leaves as string[]).slice(0, 8)
            : ["a", "b", "c", "d"];
    while (leaves.length % 2 === 1) leaves.push(leaves[leaves.length - 1] ?? "");
    const prove = Math.max(0, Math.min(leaves.length - 1, cfg.prove ?? 2));
    const lh = leaves.map((l) => h(l));
    const l0 = h(lh[0] + lh[1]);
    const l1 = h(lh[2] + lh[3]);
    const root = h(l0 + l1);
    const sib = prove < 2 ? (prove === 0 ? lh[1] : lh[0]) : prove === 2 ? lh[3] : lh[2];
    const upper = prove < 2 ? l1 : l0;
    const ids = { root: "n-root", l0: "n-l0", l1: "n-l1" };
    const leafId = (i: number): string => `n-leaf-${i}`;
    let step = 0;
    const frame = (hot: Set<string>, desc: string): VisualFrame => {
        const st = (id: string): EntityState =>
            hot.has(id) ? "comparing" : id === ids.root ? "sorted" : "idle";
        const entities: VisualEntity[] = [
            {
                id: ids.root,
                type: "node" as const,
                label: root.slice(0, 6),
                value: root,
                state: st(ids.root),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root", depth: 0 },
            },
            {
                id: ids.l0,
                type: "node" as const,
                label: (l0 ?? "").slice(0, 6),
                value: l0 ?? "",
                state: st(ids.l0),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: ids.root, depth: 1 },
            },
            {
                id: ids.l1,
                type: "node" as const,
                label: (l1 ?? "").slice(0, 6),
                value: l1 ?? "",
                state: st(ids.l1),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: ids.root, depth: 1 },
            },
            ...lh.map((v, i) => ({
                id: leafId(i),
                type: "node" as const,
                label: `${leaves[i]}:${v.slice(0, 4)}`,
                value: v,
                state: st(leafId(i)),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: i < 2 ? ids.l0 : ids.l1, depth: 2 },
            })),
        ];
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: step,
            layout: "tree",
            meta: { root, proved: leaves[prove] },
        };
    };
    yield frame(
        new Set(),
        `Leaves hash to ${lh.map((v) => v.slice(0, 4)).join(" ")}; parents link via metadata.parentId.`,
    );
    step += 1;
    yield frame(
        new Set([ids.l0, ids.l1]),
        `Level 1: h(ab)=${(l0 ?? "").slice(0, 6)}, h(cd)=${(l1 ?? "").slice(0, 6)}.`,
    );
    step += 1;
    yield frame(
        new Set([ids.root]),
        `Root ${root.slice(0, 8)} published; leaves can now be proven without revealing.`,
    );
    step += 1;
    const pair = prove < 2 ? h(lh[0] + lh[1]) : h(lh[2] + lh[3]);
    const check = h(prove < 2 ? pair + upper : upper + pair) === root;
    yield frame(
        new Set([leafId(prove)]),
        `Proof for "${leaves[prove]}": siblings [${(sib ?? "").slice(0, 6)}, ${(upper ?? "").slice(0, 6)}].`,
    );
    step += 1;
    yield frame(
        new Set([leafId(prove), ids.root]),
        `Recomputed root matches: ${check} — inclusion proven in 2 hashes.`,
    );
}

const module: AlgorithmModule = {
    id: "merkle-tree-proof",
    name: "Merkle Tree Proof",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { leaves: ["a", "b", "c", "d"], prove: 2 },
    visualType: "tree",
    run,
};

export default module;
