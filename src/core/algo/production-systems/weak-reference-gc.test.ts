/** weak-reference-gc.test.ts - Reachability, weak clearing, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./weak-reference-gc";
import type { VisualFrame } from "@/types";

interface HeapObject {
    id: number;
    strong: number[];
    weak: number[];
}

/** Independent fixed-point reachability closure over strong edges. */
function bruteReachable(objects: HeapObject[], roots: number[]): Set<number> {
    const byId = new Map(objects.map((o) => [o.id, o]));
    const reached = new Set<number>(roots.filter((id) => byId.has(id)));
    let changed = true;
    while (changed) {
        changed = false;
        for (const id of [...reached]) {
            for (const target of byId.get(id)?.strong ?? []) {
                if (byId.has(target) && !reached.has(target)) {
                    reached.add(target);
                    changed = true;
                }
            }
        }
    }
    return reached;
}

function checkFrames(frames: VisualFrame[], objects: HeapObject[]): void {
    const nodeIds = new Set(objects.map((o) => `obj-${o.id}`));
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(objects.length);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(nodeIds.has(edge.sourceId)).toBe(true);
            expect(nodeIds.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mark-Sweep GC with Weak References", () => {
    it("matches brute-force reachability and clears only dangling weak edges", () => {
        const input = mod.defaultInput as { objects: HeapObject[]; roots: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.objects);
        const meta = frames[frames.length - 1]?.meta;
        const expected = bruteReachable(input.objects, input.roots);
        expect(new Set(meta?.["reachable"] as number[])).toEqual(expected);
        const garbage = input.objects.filter((o) => !expected.has(o.id)).map((o) => o.id);
        expect(new Set(meta?.["garbage"] as number[])).toEqual(new Set(garbage));

        const expectedCleared: Array<{ from: number; to: number }> = [];
        for (const obj of input.objects) {
            for (const target of obj.weak) if (!expected.has(target)) expectedCleared.push({ from: obj.id, to: target });
        }
        expect(meta?.["clearedWeak"]).toEqual(expectedCleared);
    });

    it("handles cycles, multiple roots and a disconnected weak target", () => {
        const objects: HeapObject[] = [
            { id: 0, strong: [1], weak: [5] },
            { id: 1, strong: [2], weak: [] },
            { id: 2, strong: [0], weak: [4] },
            { id: 3, strong: [], weak: [4] },
            { id: 4, strong: [], weak: [] },
            { id: 5, strong: [], weak: [] },
        ];
        const frames = [...mod.run({ objects, roots: [0, 3] })];
        const meta = frames[frames.length - 1]?.meta;
        const expected = bruteReachable(objects, [0, 3]);
        expect(new Set(meta?.["reachable"] as number[])).toEqual(expected);
        expect(expected.has(4)).toBe(false);
        const cleared = meta?.["clearedWeak"] as Array<{ from: number; to: number }>;
        expect(cleared).toContainEqual({ from: 0, to: 5 });
        expect(cleared).toContainEqual({ from: 2, to: 4 });
        expect(cleared).toContainEqual({ from: 3, to: 4 });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
