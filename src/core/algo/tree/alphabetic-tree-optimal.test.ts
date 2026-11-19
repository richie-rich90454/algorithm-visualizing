import { describe, expect, it } from "vitest";
import mod from "./alphabetic-tree-optimal";
import type { VisualFrame } from "@/types";

/** Enumerate every full binary shape over n ordered leaves and return its cost. */
function bruteForceCost(weights: number[]): number {
    const n = weights.length;
    const recurse = (lo: number, hi: number): number[] => {
        if (lo === hi) {
            return [0];
        }
        const results: number[] = [];
        for (let k = lo; k < hi; k += 1) {
            for (const left of recurse(lo, k)) {
                for (const right of recurse(k + 1, hi)) {
                    results.push(left + right + weights.slice(lo, hi + 1).reduce((a, b) => a + b, 0));
                }
            }
        }
        return results;
    };
    return Math.min(...recurse(0, n - 1));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(["grid", "tree"]).toContain(frame.layout);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Optimal Alphabetic Tree (Dynamic Programming)", () => {
    it("matches brute force on fixed inputs", () => {
        const cases = [[4, 3, 2, 6, 5], [1, 2, 3], [5], [2, 1, 4, 3]];
        for (const weights of cases) {
            const frames = [...mod.run({ weights })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["optimalCost"]).toBe(bruteForceCost(weights));
        }
    });

    it("matches brute force on random inputs with up to five leaves", () => {
        for (let trial = 0; trial < 12; trial += 1) {
            const weights = Array.from({ length: 2 + (trial % 4) }, () => 1 + Math.floor(Math.random() * 9));
            const frames = [...mod.run({ weights })];
            expect(frames[frames.length - 1]?.meta["optimalCost"]).toBe(bruteForceCost(weights));
        }
    });

    it("keeps leaves in input order and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1];
        const parentMap = new Map<string, string>();
        for (const node of final?.entities ?? []) {
            const parent = node.metadata["parentId"];
            if (typeof parent === "string" && parent !== "root") {
                parentMap.set(node.id, parent.replace("node-", ""));
            }
        }
        const leaves = (final?.entities ?? []).filter((e) => e.id.startsWith("leaf-"));
        const order: number[] = [];
        const inOrder = (id: string): void => {
            if (id.startsWith("leaf-")) {
                order.push(Number(id.slice(5)));
                return;
            }
            const children = [...parentMap.entries()]
                .filter(([, p]) => p === id)
                .map(([c]) => c)
                .sort();
            children.forEach(inOrder);
        };
        inOrder("int-0-4");
        expect(order).toEqual(leaves.map((e) => Number(e.id.slice(5))));
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
