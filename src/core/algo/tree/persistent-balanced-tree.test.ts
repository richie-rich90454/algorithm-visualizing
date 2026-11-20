/** persistent-balanced-tree.test.ts - AVL invariant checks, version cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./persistent-balanced-tree";
import type { VisualFrame } from "@/types";

type Stored = { id: number; key: number; left: number; right: number; height: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["structure"]).toBeDefined();
    });
}

function verifyVersion(frame: VisualFrame, expected: Set<number>): void {
    const structure = frame.meta["structure"] as Stored[];
    const root = Number(frame.meta["root"]);
    const byId = new Map(structure.map((n) => [n.id, n]));
    const height = (id: number): number => (id < 0 ? 0 : byId.get(id)?.height ?? 0);
    const seen = new Set<number>();
    for (const node of structure) {
        seen.add(node.id);
        expect(node.height).toBe(1 + Math.max(height(node.left), height(node.right)));
        expect(Math.abs(height(node.left) - height(node.right))).toBeLessThanOrEqual(1);
        if (node.left >= 0) expect(byId.has(node.left)).toBe(true);
        if (node.right >= 0) expect(byId.has(node.right)).toBe(true);
    }
    expect(seen.size).toBe(structure.length);
    const inorder: number[] = [];
    const walk = (id: number): void => {
        if (id < 0) return;
        const node = byId.get(id);
        if (!node) throw new Error("dangling root");
        walk(node.left);
        inorder.push(node.key);
        walk(node.right);
    };
    walk(root);
    expect(inorder).toEqual([...expected].sort((a, b) => a - b));
    expect(frame.meta["keys"]).toEqual(inorder);
}

describe("Persistent Balanced Tree", () => {
    it("keeps every version balanced and equal to a brute-force key set", () => {
        const keys = [5, 3, 8, 1, 4, 7, 9, 2, 6];
        const frames = [...mod.run({ keys, queryVersion: keys.length, query: 6 })];
        checkFrames(frames);
        const expected = new Set<number>();
        for (const frame of frames.slice(1, 1 + keys.length)) {
            const index = Number(frame.meta["version"]) - 1;
            expected.add(keys[index] as number);
            verifyVersion(frame, new Set(expected));
        }
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).toBe(expected.has(6));
        verifyVersion(frames[frames.length - 1]!, expected);
    });

    it("preserves older versions after later insertions", () => {
        const keys = [10, 20, 30, 40, 50, 60];
        const frames = [...mod.run({ keys, queryVersion: 2, query: 20 })];
        const oldVersion = frames[frames.length - 1];
        expect(oldVersion?.meta["found"]).toBe(true);
        verifyVersion(oldVersion!, new Set([10, 20]));

        const searchMissing = [...mod.run({ keys, queryVersion: 2, query: 40 })];
        expect(searchMissing[searchMissing.length - 1]?.meta["found"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
