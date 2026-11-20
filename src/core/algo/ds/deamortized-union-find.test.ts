/**
 * deamortized-union-find.test.ts - Correctness and frame checks for deamortized union-find.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./deamortized-union-find";

type Pair = [number, number];

function drain(input: unknown): VisualFrame[] {
    const out: VisualFrame[] = [];
    for (const frame of mod.run(input)) out.push(frame);
    return out;
}

function checkShapes(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("tree");
        expect(frame.meta).toBeTypeOf("object");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Normalize component labels to the smallest member so different root choices compare equal. */
function canonical(components: number[]): number[] {
    const minByRoot = new Map<number, number>();
    components.forEach((root, i) => {
        minByRoot.set(root, Math.min(minByRoot.get(root) ?? i, i));
    });
    return components.map((root) => minByRoot.get(root) ?? root);
}

/** Brute-force reference: plain DSU with full path compression. */
function bruteComponents(n: number, unions: Pair[]): number[] {
    const parent = Array.from({ length: n }, (_, i) => i);
    const root = (x: number): number => {
        while (parent[x] !== x) {
            parent[x] = parent[parent[x]] ?? x;
            x = parent[x] ?? x;
        }
        return x;
    };
    for (const [a, b] of unions) {
        const ra = root(a);
        const rb = root(b);
        if (ra !== rb) parent[rb] = ra;
    }
    return Array.from({ length: n }, (_, i) => root(i));
}

describe("DeamortizedUnionFind", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("matches a brute-force DSU component assignment", () => {
        const input = mod.defaultInput as { n: number; unions: Pair[] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        expect(canonical(final?.meta.components as number[])).toEqual(canonical(bruteComponents(input.n, input.unions)));
    });

    it("agrees with brute force on random union sets", () => {
        for (const n of [5, 10, 16]) {
            const unions: Pair[] = [];
            for (let k = 0; k < n * 2; k += 1) {
                unions.push([Math.floor(Math.random() * n), Math.floor(Math.random() * n)]);
            }
            const frames = drain({ n, unions, finds: [0] });
            const final = frames[frames.length - 1];
            expect(canonical(final?.meta.components as number[])).toEqual(canonical(bruteComponents(n, unions)));
        }
    });

    it("keeps deferred work bounded to at most one step per operation", () => {
        const input = mod.defaultInput as { n: number; unions: Pair[]; finds: number[] };
        const frames = drain(input);
        const ops = input.unions.length * 2 + input.finds.length;
        const final = frames[frames.length - 1];
        expect(final?.meta.deferredSteps).toBeLessThanOrEqual(ops);
    });

    it("terminates cleanly", () => {
        const input = mod.defaultInput as { n: number; unions: Pair[]; finds: number[] };
        const gen = mod.run(input);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBe(input.unions.length + input.finds.length + 2);
        expect(gen.next().done).toBe(true);
    });
});
