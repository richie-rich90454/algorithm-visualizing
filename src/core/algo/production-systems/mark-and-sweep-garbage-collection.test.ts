/**
 * mark-and-sweep-garbage-collection.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mark-and-sweep-garbage-collection";
import type { VisualFrame } from "@/types";

/** Independent breadth-first reachability reference. */
function reachable(objects: string[], refs: Record<string, string[]>, roots: string[]): Set<string> {
    const known = new Set(objects);
    const seen = new Set<string>();
    const queue = roots.filter((id) => known.has(id));
    while (queue.length > 0) {
        const id = queue.shift();
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        for (const next of refs[id] ?? []) {
            if (known.has(next) && !seen.has(next)) queue.push(next);
        }
    }
    return seen;
}

function checkFrames(frames: VisualFrame[], nObjects: number, nEdges: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nObjects);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(nEdges);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mark and sweep garbage collection", () => {
    it("marks exactly the reachable set and collects the rest", () => {
        const input = mod.defaultInput as { objects: string[]; refs: Record<string, string[]>; roots: string[] };
        const frames = [...mod.run(input)] as VisualFrame[];
        const edgeCount = Object.values(input.refs).reduce((s, list) => s + list.length, 0);
        checkFrames(frames, input.objects.length, edgeCount);
        const expected = reachable(input.objects, input.refs, input.roots);
        const finalMeta = frames[frames.length - 1]?.meta;
        const gotReachable = finalMeta?.["reachable"] as string[];
        const gotCollected = finalMeta?.["collected"] as string[];
        expect(new Set(gotReachable)).toEqual(expected);
        const expectedCollected = input.objects.filter((id) => !expected.has(id));
        expect(new Set(gotCollected)).toEqual(new Set(expectedCollected));
        expect(gotReachable.length + gotCollected.length).toBe(input.objects.length);
    });

    it("handles multiple roots and self cycles", () => {
        const input = {
            objects: ["X", "Y", "Z", "W"],
            refs: { X: ["Y"], Y: ["X"], Z: ["W"], W: ["X"] },
            roots: ["X", "Z"],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 4, 4);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(new Set(finalMeta?.["reachable"] as string[])).toEqual(new Set(["X", "Y", "Z", "W"]));
        expect(finalMeta?.["collected"]).toEqual([]);
    });

    it("collects everything when no roots are provided", () => {
        const frames = [...mod.run({ objects: ["A", "B"], refs: { A: ["B"], B: [] }, roots: [] })];
        checkFrames(frames, 2, 1);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["reachable"]).toEqual([]);
        expect(new Set(finalMeta?.["collected"] as string[])).toEqual(new Set(["A", "B"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
