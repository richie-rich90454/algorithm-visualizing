/**
 * decision-tree-cart.test.ts - Brute-force split optimality, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./decision-tree-cart";
import type { VisualFrame } from "@/types";

type Point = [number, number];
interface Input {
    points: Point[];
    labels: number[];
    maxDepth: number;
}

function giniOf(ones: number, count: number): number {
    if (count === 0) {
        return 0;
    }
    const p = ones / count;
    return 1 - p * p - (1 - p) * (1 - p);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const entity of frame.entities) {
            expect(Number.isFinite(entity.metadata["depth"] as number)).toBe(true);
            expect(Number.isFinite(entity.metadata["gini"] as number)).toBe(true);
        }
    });
}

describe("Decision Tree CART", () => {
    it("chooses the brute-force optimal split at every internal node", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        if (!final) {
            throw new Error("no final frame");
        }
        const nodes = final.entities;
        const byId = new Map(nodes.map((entity) => [entity.id, entity]));

        // Determine which training points reach each node by following left/right ids.
        const reaching = new Map<string, number[]>();
        for (const node of nodes) {
            reaching.set(node.id, []);
        }
        for (let i = 0; i < input.points.length; i += 1) {
            const point = input.points[i] ?? [0, 0];
            let id = "node-0";
            while (true) {
                const node = byId.get(id);
                if (!node || node.metadata["isLeaf"] === true) {
                    break;
                }
                reaching.get(id)?.push(i);
                const goLeft = (point[node.metadata["feature"] as number] ?? 0) <= (node.metadata["threshold"] as number);
                const childId = goLeft ? node.metadata["left"] : node.metadata["right"];
                if (typeof childId !== "number" || childId < 0) {
                    break;
                }
                id = `node-${childId}`;
            }
        }

        for (const node of nodes) {
            if (node.metadata["isLeaf"] === true) {
                continue;
            }
            const indices = reaching.get(node.id) ?? [];
            const feature = node.metadata["feature"] as number;
            const threshold = node.metadata["threshold"] as number;
            const n = indices.length;
            expect(n).toBeGreaterThan(0);

            // Recompute the chosen split's weighted Gini from scratch.
            let leftOnes = 0;
            let rightOnes = 0;
            let nLeft = 0;
            for (const index of indices) {
                const point = input.points[index] ?? [0, 0];
                const label = input.labels[index] ?? 0;
                if (point[feature] <= threshold) {
                    leftOnes += label;
                    nLeft += 1;
                } else {
                    rightOnes += label;
                }
            }
            const chosen =
                (nLeft / n) * giniOf(leftOnes, nLeft) + ((n - nLeft) / n) * giniOf(rightOnes, n - nLeft);
            expect(chosen).toBeCloseTo(node.metadata["weightedGini"] as number, 10);

            // Brute force every midpoint threshold on both features; none beats it.
            for (let f = 0; f < 2; f += 1) {
                const values = indices.map((index) => (input.points[index] ?? [0, 0])[f]).sort((a, b) => a - b);
                for (let k = 0; k + 1 < values.length; k += 1) {
                    if (values[k] === values[k + 1]) {
                        continue;
                    }
                    const t = ((values[k] ?? 0) + (values[k + 1] ?? 0)) / 2;
                    let lo = 0;
                    let ro = 0;
                    let countLeft = 0;
                    for (const index of indices) {
                        const point = input.points[index] ?? [0, 0];
                        const label = input.labels[index] ?? 0;
                        if (point[f] <= t) {
                            lo += label;
                            countLeft += 1;
                        } else {
                            ro += label;
                        }
                    }
                    if (countLeft === 0 || countLeft === n) {
                        continue;
                    }
                    const weighted =
                        (countLeft / n) * giniOf(lo, countLeft) +
                        ((n - countLeft) / n) * giniOf(ro, n - countLeft);
                    expect(weighted).toBeGreaterThanOrEqual(chosen - 1e-9);
                }
            }
        }
    });

    it("fits a separable training set and keeps leaves pure", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["accuracy"]).toBe(1);
        for (const node of final?.entities ?? []) {
            if (node.metadata["isLeaf"] === true) {
                const ones = node.metadata["ones"] as number;
                const count = node.metadata["count"] as number;
                expect(ones === 0 || ones === count).toBe(true);
            }
        }
    });

    it("reveals one node per frame and terminates cleanly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const total = Number(frames[0]?.meta["totalNodes"]);
        expect(frames.length).toBe(total + 2);
        const finalCount = frames[frames.length - 2]?.entities.length ?? 0;
        expect(finalCount).toBe(total);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
