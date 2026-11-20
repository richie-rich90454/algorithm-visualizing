/**
 * tree-edit-distance-zhang-shasha.test.ts - Brute-force mapping cross-check,
 * frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-edit-distance-zhang-shasha";
import type { VisualFrame } from "@/types";

type Spec = { ids: string[]; parentMap: Record<string, string | null>; labels?: Record<string, string> };

type Numbering = {
    ids: string[];
    labels: string[];
    pre: number[];
    post: number[];
    anc: boolean[][];
};

/** Independent postorder/preorder numbering for the brute-force checker. */
function numbering(spec: Spec): Numbering {
    const children = new Map<string, string[]>();
    for (const id of spec.ids) {
        children.set(id, []);
    }
    for (const id of spec.ids) {
        const p = spec.parentMap[id];
        if (p) {
            children.get(p)?.push(id);
        }
    }
    const root = spec.ids.find((id) => !spec.parentMap[id]) ?? spec.ids[0] ?? "n0";
    const pre: number[] = [];
    const post: number[] = [];
    const labels: string[] = [];
    const ids: string[] = [];
    const preIndex = new Map<string, number>();
    const visit = (id: string): void => {
        preIndex.set(id, pre.length + 1);
        pre.push(0);
        post.push(0);
        labels.push(spec.labels?.[id] ?? id);
        ids.push(id);
        for (const c of children.get(id) ?? []) {
            visit(c);
        }
    };
    visit(root);
    // Fill preorder values correctly after recursion.
    let t = 0;
    const order: string[] = [];
    const visitPre = (id: string): void => {
        t += 1;
        pre[preIndex.get(id) as number - 1] = t;
        order.push(id);
        for (const c of children.get(id) ?? []) {
            visitPre(c);
        }
    };
    visitPre(root);
    let p = 0;
    const visitPost = (id: string): void => {
        for (const c of children.get(id) ?? []) {
            visitPost(c);
        }
        p += 1;
        post[preIndex.get(id) as number - 1] = p;
    };
    visitPost(root);

    const n = ids.length;
    const anc: boolean[][] = Array.from({ length: n + 1 }, () => new Array<boolean>(n + 1).fill(false));
    const isAncestor = (a: string, b: string): boolean => {
        const ai = preIndex.get(a) as number;
        const bi = preIndex.get(b) as number;
        if (ai > bi) {
            return false;
        }
        const sub = children.get(a) ?? [];
        const walk = (x: string): boolean => {
            for (const c of children.get(x) ?? []) {
                if (c === b || walk(c)) {
                    return true;
                }
            }
            return false;
        };
        return sub.some((c) => c === b || walk(c));
    };
    for (const a of ids) {
        for (const b of ids) {
            const ai = preIndex.get(a) as number;
            const bi = preIndex.get(b) as number;
            anc[ai]![bi] = isAncestor(a, b);
        }
    }
    return { ids, labels, pre, post, anc };
}

/**
 * Brute force over all node-pair subsets that form a valid ordered-tree
 * mapping. With unit costs the minimum is the tree edit distance.
 */
function bruteDistance(specA: Spec, specB: Spec): number {
    const a = numbering(specA);
    const b = numbering(specB);
    const pairs: Array<[number, number]> = [];
    for (let i = 1; i <= a.ids.length; i += 1) {
        for (let j = 1; j <= b.ids.length; j += 1) {
            pairs.push([i, j]);
        }
    }
    const valid = (chosen: Array<[number, number]>): boolean => {
        if (new Set(chosen.map((p) => p[0])).size !== chosen.length) {
            return false;
        }
        if (new Set(chosen.map((p) => p[1])).size !== chosen.length) {
            return false;
        }
        for (let x = 0; x < chosen.length; x += 1) {
            for (let y = x + 1; y < chosen.length; y += 1) {
                const [i, j] = chosen[x] as [number, number];
                const [k, l] = chosen[y] as [number, number];
                const ancIK = a.anc[i]![k] as boolean;
                const ancKI = a.anc[k]![i] as boolean;
                const ancJL = b.anc[j]![l] as boolean;
                const ancLJ = b.anc[l]![j] as boolean;
                if (ancIK !== ancJL || ancKI !== ancLJ) {
                    return false;
                }
                const preA1 = a.pre[i - 1] as number;
                const preA2 = a.pre[k - 1] as number;
                const preB1 = b.pre[j - 1] as number;
                const preB2 = b.pre[l - 1] as number;
                if (!ancIK && !ancKI && preA1 > preA2 && preB1 < preB2) {
                    return false;
                }
                if (!ancIK && !ancKI && preA1 < preA2 && preB1 > preB2) {
                    return false;
                }
            }
        }
        return true;
    };

    let best = a.ids.length + b.ids.length;
    const search = (index: number, chosen: Array<[number, number]>): void => {
        if (chosen.length > 0 && valid(chosen)) {
            let cost = a.ids.length + b.ids.length - 2 * chosen.length;
            for (const [i, j] of chosen) {
                if (a.labels[i - 1] !== b.labels[j - 1]) {
                    cost += 1;
                }
            }
            best = Math.min(best, cost);
        }
        if (index === pairs.length) {
            return;
        }
        const pair = pairs[index] as [number, number];
        search(index + 1, chosen);
        chosen.push(pair);
        search(index + 1, chosen);
        chosen.pop();
    };
    search(0, []);
    return best;
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

function distanceOf(specA: Spec, specB: Spec): number {
    const frames = [...mod.run({ treeA: specA, treeB: specB })];
    checkFrames(frames);
    return Number(frames[frames.length - 1]?.meta["distance"]);
}

const chainA: Spec = {
    ids: ["A", "B", "C"],
    parentMap: { A: null, B: "A", C: "B" },
    labels: { A: "a", B: "b", C: "c" },
};
const chainB: Spec = {
    ids: ["X", "Y", "Z"],
    parentMap: { X: null, Y: "X", Z: "Y" },
    labels: { X: "a", Y: "b", Z: "c" },
};
const chainDiff: Spec = {
    ids: ["X", "Y", "Z"],
    parentMap: { X: null, Y: "X", Z: "Y" },
    labels: { X: "a", Y: "x", Z: "c" },
};
const forkA: Spec = {
    ids: ["A", "B", "C"],
    parentMap: { A: null, B: "A", C: "A" },
    labels: { A: "a", B: "b", C: "c" },
};
const forkB: Spec = {
    ids: ["X", "Y", "Z"],
    parentMap: { X: null, Y: "X", Z: "X" },
    labels: { X: "a", Y: "c", Z: "b" },
};
const pair4: Spec = {
    ids: ["A", "B", "C", "D"],
    parentMap: { A: null, B: "A", C: "B", D: "C" },
    labels: { A: "a", B: "b", C: "c", D: "d" },
};
const pair3: Spec = {
    ids: ["X", "Y", "Z"],
    parentMap: { X: null, Y: "X", Z: "Y" },
    labels: { X: "a", Y: "b", Z: "d" },
};

describe("Zhang-Shasha Tree Edit Distance", () => {
    it("matches a brute-force mapping search", () => {
        const cases: Array<[Spec, Spec]> = [
            [chainA, chainB],
            [chainA, chainDiff],
            [chainA, forkA],
            [forkA, forkB],
            [pair4, pair3],
            [forkB, chainB],
        ];
        for (const [a, b] of cases) {
            expect(distanceOf(a, b)).toBe(bruteDistance(a, b));
        }
    });

    it("satisfies the metric identity and symmetry sanity checks", () => {
        expect(distanceOf(chainA, chainB)).toBe(0);
        expect(distanceOf(chainB, chainA)).toBe(distanceOf(chainA, chainB));
        expect(distanceOf(chainA, chainDiff)).toBeGreaterThan(0);
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
