import { describe, expect, it } from "vitest";
import mod from "./hu-tucker-algorithm";
import type { VisualFrame } from "@/types";

function optimalCost(weights: number[]): number {
    const n = weights.length;
    if (n === 0) return 0;
    const dp = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let len = 2; len <= n; len += 1) {
        for (let i = 0; i + len <= n; i += 1) {
            const j = i + len - 1;
            const sum = weights.slice(i, j + 1).reduce((a, b) => a + b, 0);
            let best = Infinity;
            for (let k = i; k < j; k += 1) {
                best = Math.min(best, (dp[i]?.[k] ?? 0) + (dp[k + 1]?.[j] ?? 0));
            }
            dp[i][j] = sum + best;
        }
    }
    return dp[0]?.[n - 1] ?? 0;
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

describe("Hu-Tucker Algorithm", () => {
    it("matches the alphabetic-tree DP optimum", () => {
        for (const weights of [[4, 3, 2, 6, 5], [1, 2, 3], [5], [2, 1, 4, 3, 7, 2]]) {
            const frames = [...mod.run({ weights })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["optimalCost"]).toBe(optimalCost(weights));
        }
        for (let trial = 0; trial < 12; trial += 1) {
            const weights = Array.from({ length: 2 + (trial % 5) }, () => 1 + Math.floor(Math.random() * 12));
            const frames = [...mod.run({ weights })];
            expect(frames[frames.length - 1]?.meta["optimalCost"]).toBe(optimalCost(weights));
        }
    });

    it("keeps leaves in order and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1];
        const parentMap = new Map<string, string>();
        for (const node of final?.entities ?? []) {
            const parent = node.metadata["parentId"];
            if (typeof parent === "string" && parent !== "root") {
                parentMap.set(node.id.replace("node-", ""), parent.replace("node-", ""));
            }
        }
        const order: number[] = [];
        const inOrder = (id: string): void => {
            if (id.startsWith("leaf-")) {
                order.push(Number(id.slice(5)));
                return;
            }
            (final?.entities ?? [])
                .filter((e) => parentMap.get(e.id.replace("node-", "")) === id)
                .map((e) => e.id.replace("node-", ""))
                .forEach(inOrder);
        };
        const roots = (final?.entities ?? [])
            .filter((e) => e.metadata["parentId"] === "root")
            .map((e) => e.id.replace("node-", ""));
        roots.forEach(inOrder);
        expect(order).toEqual([0, 1, 2, 3, 4]);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
