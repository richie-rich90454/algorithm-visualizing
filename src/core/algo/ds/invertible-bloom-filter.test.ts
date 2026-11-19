import { describe, expect, it } from "vitest";
import mod, { createIblt, ibltDelete, ibltInsert, ibltPeel } from "./invertible-bloom-filter";
import type { VisualFrame } from "@/types";

/** Independent set-difference oracle: the expected remaining keys. */
function expectedRemaining(keys: number[], deletes: number[]): number[] {
    const removed = new Set(deletes);
    return keys.filter((key) => !removed.has(key)).sort((a, b) => a - b);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(Number(frame.meta["size"]));
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 10);
        expect(frame.meta).toBeDefined();
    });
}

describe("Invertible Bloom Lookup Table", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["success"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("peels exactly the remaining keys across randomized trials", () => {
        let seed = 12345;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const count = 1 + rand(8);
            const keys: number[] = [];
            for (let i = 0; i < count; i += 1) {
                const key = 1 + rand(1000);
                if (!keys.includes(key)) {
                    keys.push(key);
                }
            }
            const deletes = keys.filter(() => rand(3) === 0).slice(0, 3);
            const table = createIblt(64, 3);
            for (const key of keys) {
                ibltInsert(table, key);
            }
            for (const key of deletes) {
                ibltDelete(table, key);
            }
            const result = ibltPeel(table);
            const decoded = result.decoded.sort((a, b) => a - b);
            const expected = expectedRemaining(keys, deletes);
            expect(result.complete).toBe(true);
            expect(decoded).toEqual(expected);
        }
    });

    it("recovers an empty set after inserting and deleting the same key", () => {
        const table = createIblt(16, 3);
        ibltInsert(table, 42);
        ibltDelete(table, 42);
        const result = ibltPeel(table);
        expect(result.complete).toBe(true);
        expect(result.decoded).toEqual([]);
    });
});
