/**
 * garbage-collection-copying.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./garbage-collection-copying";
import type { VisualFrame } from "@/types";

interface Obj { id: number; fields: number[] }

function checkFrames(frames: VisualFrame[], objectCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(objectCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const entityIds = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(entityIds.has(edge.sourceId)).toBe(true);
            expect(entityIds.has(edge.targetId)).toBe(true);
        }
    });
}

/** Independent reachability closure from the roots. */
function reachable(roots: number[], objects: Obj[]): number[] {
    const byId = new Map(objects.map((o) => [o.id, o]));
    const seen = new Set<number>();
    const stack = roots.filter((id) => byId.has(id));
    while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const field of byId.get(id)!.fields) {
            if (byId.has(field) && !seen.has(field)) stack.push(field);
        }
    }
    return [...seen].sort((a, b) => a - b);
}

describe("Semi-Space Copying Garbage Collection", () => {
    it("copies exactly the reachable objects and leaves the rest as garbage", () => {
        const input = mod.defaultInput as { roots: number[]; objects: Obj[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.objects.length);
        const finalMeta = frames[frames.length - 1]!.meta;
        const expected = reachable(input.roots, input.objects);
        expect(finalMeta["copied"]).toEqual(expected);
        expect(finalMeta["toSpaceSize"]).toBe(expected.length);
        expect(finalMeta["copied"]).not.toContain(4);
        expect(finalMeta["copied"]).not.toContain(5);
    });

    it("keeps a consistent, single forwarding address per copied object", () => {
        const input = mod.defaultInput as { roots: number[]; objects: Obj[] };
        const frames = [...mod.run(input)];
        const flat = frames[frames.length - 1]!.meta["forwarding"] as number[];
        expect(flat.length % 2).toBe(0);
        const ids = new Set<number>();
        const addresses = new Set<number>();
        for (let i = 0; i < flat.length; i += 2) {
            ids.add(flat[i]!);
            addresses.add(flat[i + 1]!);
        }
        expect(ids.size).toBe(flat.length / 2);
        expect(addresses.size).toBe(flat.length / 2);
        for (const address of addresses) {
            expect(address).toBeGreaterThanOrEqual(0);
            expect(address).toBeLessThan(ids.size);
        }
        // Roots map to distinct new addresses that are part of the table.
        const newRoots = frames[frames.length - 1]!.meta["newRoots"] as number[];
        expect(newRoots.length).toBe(input.roots.length);
        newRoots.forEach((address) => expect(addresses.has(address)).toBe(true));
    });

    it("handles cycles, self-loops, shared references, and empty roots", () => {
        const objects: Obj[] = [
            { id: 0, fields: [1, 1, 2] },
            { id: 1, fields: [0] },
            { id: 2, fields: [2] },
            { id: 9, fields: [] },
        ];
        const frames = [...mod.run({ roots: [0], objects })];
        checkFrames(frames, objects.length);
        expect(frames[frames.length - 1]!.meta["copied"]).toEqual([0, 1, 2]);
        expect(frames[frames.length - 1]!.meta["toSpaceSize"]).toBe(3);

        const noRoots = [...mod.run({ roots: [], objects })];
        expect(noRoots[noRoots.length - 1]!.meta["copied"]).toEqual([]);
        expect(noRoots[noRoots.length - 1]!.meta["toSpaceSize"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
