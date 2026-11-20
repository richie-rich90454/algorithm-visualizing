/**
 * log-structured-merge-read-path.test.ts - Independent newest-first reference,
 * Bloom no-false-negative property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./log-structured-merge-read-path";
import type { VisualFrame } from "@/types";

interface TableInput {
    id: string;
    minKey: string;
    maxKey: string;
    keys?: Record<string, number | string>;
}

interface Input {
    key: string;
    memtable: Record<string, number | string>;
    levels: TableInput[][];
}

function checkFrames(frames: VisualFrame[], components: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(components);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.entities.every((entity) => entity.metadata["row"] === 0)).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Exact newest-to-oldest reference, ignoring Bloom optimizations. */
function reference(input: Input): { found: boolean; value: number | string; deleted: boolean } {
    const { key, memtable, levels } = input;
    if (Object.prototype.hasOwnProperty.call(memtable, key)) {
        const value = memtable[key] ?? "";
        return { found: true, value, deleted: value === "TOMBSTONE" };
    }
    for (const level of levels) {
        for (const table of level) {
            if (key >= table.minKey && key <= table.maxKey) {
                const keys = table.keys ?? {};
                if (Object.prototype.hasOwnProperty.call(keys, key)) {
                    const value = keys[key] ?? "";
                    return { found: true, value, deleted: value === "TOMBSTONE" };
                }
            }
        }
    }
    return { found: false, value: "", deleted: false };
}

function componentCount(input: Input): number {
    let count = 1;
    for (const level of input.levels) {
        count += level.length;
    }
    return count;
}

describe("LSM tree read path", () => {
    it("agrees with an exact newest-first reference across keys", () => {
        const input: Input = {
            key: "k47",
            memtable: { b: "2" },
            levels: [
                [{ id: "s0", minKey: "a", maxKey: "m", keys: { a: "1", c: "3" } }],
                [{ id: "s1", minKey: "k", maxKey: "z", keys: { k47: "47", z: "26" } }],
            ],
        };
        for (const key of ["k47", "a", "b", "z", "missing"]) {
            const testCase = { ...input, key };
            const frames = [...mod.run(testCase)];
            checkFrames(frames, componentCount(testCase));
            const want = reference(testCase);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["found"]).toBe(want.found);
            expect(last?.["value"]).toBe(want.value);
            expect(last?.["deleted"]).toBe(want.deleted);
        }
    });

    it("never Bloom-skips a table that actually contains the key", () => {
        const input: Input = {
            key: "k47",
            memtable: { a: "0" },
            levels: [
                [{ id: "s0", minKey: "a", maxKey: "z", keys: { k47: "47", other: "1" } }],
                [{ id: "s1", minKey: "a", maxKey: "z", keys: { k47: "old", zz: "9" } }],
            ],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, componentCount(input));
        const last = frames[frames.length - 1]?.meta;
        const skipped = new Set(last?.["skippedByBloom"] as string[]);
        for (const tableId of last?.["tablesWithKey"] as string[]) {
            expect(skipped.has(tableId)).toBe(false);
        }
        expect(last?.["value"]).toBe("47");
        expect(Number(last?.["probes"])).toBe((last?.["path"] as string[]).length);
    });

    it("stops at a memtable tombstone", () => {
        const input: Input = {
            key: "gone",
            memtable: { gone: "TOMBSTONE" },
            levels: [[{ id: "s0", minKey: "a", maxKey: "z", keys: { gone: "old" } }]],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, componentCount(input));
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["found"]).toBe(true);
        expect(last?.["deleted"]).toBe(true);
        expect(last?.["path"]).toEqual(["memtable"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
