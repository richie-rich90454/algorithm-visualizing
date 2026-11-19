/**
 * weight-biased-leftist-tree.test.ts - Correctness, invariant, frame, and
 * termination checks for the weight-biased leftist tree.
 */

import { describe, expect, it } from "vitest";
import mod from "./weight-biased-leftist-tree";
import type { VisualFrame } from "@/types";

/** Check frame shape and the structural invariants visible in the frames. */
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();

        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }

        const byId = new Map(frame.entities.map((e) => [e.id, e]));
        let roots = 0;
        for (const entity of frame.entities) {
            const parentId = String(entity.metadata["parentId"]);
            if (parentId === "root" || parentId === "") {
                roots += 1;
                continue;
            }
            const parent = byId.get(parentId);
            expect(parent, `parent ${parentId} must exist`).toBeDefined();
            if (parent) {
                expect(Number(parent.metadata["key"])).toBeLessThanOrEqual(Number(entity.metadata["key"]));
            }
        }
        expect(roots).toBe(1);
    });
}

describe("Weight-Biased Leftist Tree", () => {
    it("extracts keys in sorted order on the default input", () => {
        const input = mod.defaultInput as { inserts: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const extracted = final?.meta["extracted"] as number[];
        expect(extracted).toEqual([...input.inserts].sort((a, b) => a - b));
    });

    it("extracts keys in sorted order across random and duplicate-heavy inputs", () => {
        const cases: number[][] = [
            [],
            [7],
            [2, 2, 2, 2],
            [9, 1, 9, 1, 5, 3, 8, 3],
        ];
        for (let t = 0; t < 20; t += 1) {
            const arr: number[] = [];
            for (let i = 0; i < 12; i += 1) {
                arr.push(Math.floor(Math.random() * 20));
            }
            cases.push(arr);
        }
        for (const inserts of cases) {
            const frames = [...mod.run({ inserts })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            const extracted = final?.meta["extracted"] as number[];
            expect(extracted).toEqual([...inserts].sort((a, b) => a - b));
        }
    });

    it("keeps the reported subtree weights and the weight-bias invariant", () => {
        const frames = [...mod.run({ inserts: [5, 3, 8, 1, 9, 4, 7, 2, 6] })];
        for (const frame of frames) {
            if (frame.entities.length === 1 && frame.entities[0]?.id === "empty") {
                continue;
            }
            const byId = new Map(frame.entities.map((e) => [e.id, e]));
            const children = new Map<string, string[]>();
            for (const entity of frame.entities) {
                const parentId = String(entity.metadata["parentId"]);
                if (parentId === "root") {
                    continue;
                }
                expect(byId.has(parentId)).toBe(true);
                const list = children.get(parentId) ?? [];
                list.push(entity.id);
                children.set(parentId, list);
            }
            const subtreeSize = (id: string): number => {
                const kids = children.get(id) ?? [];
                return 1 + kids.reduce((sum, kid) => sum + subtreeSize(kid), 0);
            };
            for (const entity of frame.entities) {
                expect(Number(entity.metadata["weight"])).toBe(subtreeSize(entity.id));
                const kids = children.get(entity.id) ?? [];
                const left = kids.find((kid) => byId.get(kid)?.metadata["side"] === "L");
                const right = kids.find((kid) => byId.get(kid)?.metadata["side"] === "R");
                const leftWeight = left ? subtreeSize(left) : 0;
                const rightWeight = right ? subtreeSize(right) : 0;
                expect(leftWeight).toBeGreaterThanOrEqual(rightWeight);
            }
        }
        const final = frames[frames.length - 1];
        expect(final?.meta["size"]).toBe(0);
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
