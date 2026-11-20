/**
 * tree-isomorphism-unrooted.test.ts - Brute-force isomorphism cross-check,
 * frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-isomorphism-unrooted";
import type { VisualFrame } from "@/types";

type Spec = { ids: string[]; parentMap: Record<string, string | null> };

/** Build an undirected adjacency map from the parent representation. */
function adjacency(spec: Spec): Map<string, Set<string>> {
    const adj = new Map<string, Set<string>>();
    for (const id of spec.ids) {
        adj.set(id, new Set());
    }
    for (const id of spec.ids) {
        const p = spec.parentMap[id];
        if (p) {
            adj.get(id)?.add(p);
            adj.get(p)?.add(id);
        }
    }
    return adj;
}

/** Brute force: some bijection preserves adjacency exactly. */
function bruteIsomorphic(a: Spec, b: Spec): boolean {
    if (a.ids.length !== b.ids.length) {
        return false;
    }
    const adjA = adjacency(a);
    const adjB = adjacency(b);
    const perm = [...b.ids];
    const seen = new Array<boolean>(perm.length).fill(false);
    const map = new Map<string, string>();
    const search = (index: number): boolean => {
        if (index === a.ids.length) {
            for (const u of a.ids) {
                for (const v of a.ids) {
                    if (u === v) {
                        continue;
                    }
                    const uu = map.get(u);
                    const vv = map.get(v);
                    if (!uu || !vv) {
                        return false;
                    }
                    const linkedA = adjA.get(u)?.has(v) ?? false;
                    const linkedB = adjB.get(uu)?.has(vv) ?? false;
                    if (linkedA !== linkedB) {
                        return false;
                    }
                }
            }
            return true;
        }
        const source = a.ids[index] as string;
        for (let j = 0; j < perm.length; j += 1) {
            if (seen[j]) {
                continue;
            }
            seen[j] = true;
            map.set(source, perm[j] as string);
            if (search(index + 1)) {
                return true;
            }
            map.delete(source);
            seen[j] = false;
        }
        return false;
    };
    return search(0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function resultOf(a: Spec, b: Spec): boolean {
    const frames = [...mod.run({ treeA: a, treeB: b })];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta["isomorphic"] === true;
}

const path4: Spec = {
    ids: ["A", "B", "C", "D"],
    parentMap: { A: null, B: "A", C: "B", D: "C" },
};
const path4Relabeled: Spec = {
    ids: ["W", "X", "Y", "Z"],
    parentMap: { W: null, X: "W", Y: "X", Z: "Y" },
};
const star4: Spec = {
    ids: ["A", "B", "C", "D"],
    parentMap: { A: null, B: "A", C: "A", D: "A" },
};
const tShape: Spec = {
    ids: ["A", "B", "C", "D", "E"],
    parentMap: { A: null, B: "A", C: "A", D: "A", E: "A" },
};
const tShapeRelabeled: Spec = {
    ids: ["P", "Q", "R", "S", "T"],
    parentMap: { P: null, Q: "P", R: "P", S: "P", T: "P" },
};

describe("Unrooted Tree Isomorphism", () => {
    it("matches a brute-force bijection check on small tree pairs", () => {
        const pairs: Array<[Spec, Spec]> = [
            [path4, path4Relabeled],
            [path4, star4],
            [star4, tShape],
            [tShape, tShapeRelabeled],
            [path4, tShape],
        ];
        for (const [a, b] of pairs) {
            expect(resultOf(a, b)).toBe(bruteIsomorphic(a, b));
        }
    });

    it("is invariant to root choice and vertex names", () => {
        expect(resultOf(path4, path4Relabeled)).toBe(true);
        expect(resultOf(tShape, tShapeRelabeled)).toBe(true);
        const frames = [...mod.run({ treeA: path4, treeB: path4Relabeled })];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["canonicalA"]).toBe(last?.["canonicalB"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
