/** critbit-tree.test.ts - Reference set cross-check, tree-property check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./critbit-tree";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independently search the trie encoded in a frame using critical-bit tests. */
function searchInFrame(frame: VisualFrame, key: number, width: number): boolean {
    const byId = new Map(frame.entities.map((e) => [e.id, e]));
    const children = new Map<string, { left?: string; right?: string; bit?: number }>();
    for (const edge of frame.edges) {
        const entry = children.get(edge.sourceId) ?? {};
        if (edge.label === "0") entry.left = edge.targetId;
        if (edge.label === "1") entry.right = edge.targetId;
        children.set(edge.sourceId, entry);
    }
    for (const entity of frame.entities) {
        const match = /^b(\d+)$/.exec(entity.label);
        if (match) {
            const entry = children.get(entity.id) ?? {};
            entry.bit = Number(match[1]);
            children.set(entity.id, entry);
        }
    }
    const targets = new Set(frame.edges.map((e) => e.targetId));
    const root = frame.entities.find((e) => !targets.has(e.id));
    let current = root?.id;
    while (current) {
        const links = children.get(current);
        if (!links || links.bit === undefined) {
            return byId.get(current)?.label === String(key);
        }
        const bit = (key >>> (width - 1 - links.bit)) & 1;
        current = bit === 0 ? links.left : links.right;
    }
    return false;
}

function leafCount(frame: VisualFrame): number {
    const parents = new Set(frame.edges.map((e) => e.sourceId));
    return frame.entities.filter((e) => e.id !== "empty" && !parents.has(e.id)).length;
}

describe("Critical-Bit Trie", () => {
    it("matches a reference set across the whole key space", () => {
        const input = mod.defaultInput as { keys: number[]; width: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = new Set(input.keys);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["size"]).toBe(expected.size);
        const finalFrame = frames[frames.length - 1] as VisualFrame;
        expect(leafCount(finalFrame)).toBe(expected.size);
        for (let key = 0; key < 2 ** input.width; key += 1) {
            expect(searchInFrame(finalFrame, key, input.width)).toBe(expected.has(key));
        }

        const found = finalMeta?.["found"] as number[];
        expect(found.every((value) => value === 1)).toBe(true);
    });

    it("handles duplicates, singletons, and ordering", () => {
        for (const keys of [[3, 3, 3], [7], [0, 15, 8, 4, 2, 1]]) {
            const frames = [...mod.run({ keys, width: 4 })];
            checkFrames(frames);
            const finalFrame = frames[frames.length - 1] as VisualFrame;
            const expected = new Set(keys);
            expect(leafCount(finalFrame)).toBe(expected.size);
            for (let key = 0; key < 16; key += 1) {
                expect(searchInFrame(finalFrame, key, 4)).toBe(expected.has(key));
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
