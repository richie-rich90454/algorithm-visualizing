/**
 * d-left-hashing.test.ts - Placement properties, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./d-left-hashing";
import type { VisualFrame } from "@/types";

function hashKey(key: string, seed: number, buckets: number): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
        h ^= key.charCodeAt(i) + seed * 31;
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % buckets;
}

/** Replay the leftmost-free rule and return the bucket chosen for each key. */
function reference(keys: string[], d: number, buckets: number): Array<[number, number] | null> {
    const table: string[][] = Array.from({ length: d * buckets }, () => []);
    return keys.map((key) => {
        for (let t = 0; t < d; t += 1) {
            const b = hashKey(key, t + 1, buckets);
            const cell = table[t * buckets + b]!;
            if (cell.length < 2) {
                cell.push(key);
                return [t, b];
            }
        }
        return null;
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("d-Left Hashing", () => {
    it("matches the leftmost-free placement rule on random inputs", () => {
        const keys = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
        for (const d of [1, 2, 3]) {
            for (const buckets of [2, 3, 4]) {
                const frames = [...mod.run({ keys, d, buckets })];
                checkFrames(frames);
                const expected = reference(keys, d, buckets);
                const placedFrames = frames.slice(1, -1);
                expect(placedFrames).toHaveLength(keys.length);
                let expectedPlaced = 0;
                placedFrames.forEach((frame, index) => {
                    const target = expected[index];
                    if (target !== null) expectedPlaced += 1;
                    if (target === null) {
                        expect(frame.meta["placed"]).toBe(expectedPlaced);
                    } else {
                        expect(frame.meta["rows"]).toBe(d);
                        expect(frame.meta["cols"]).toBe(buckets);
                        expect(frame.meta["placed"]).toBe(expectedPlaced);
                    }
                    const active = frame.entities.find((entity) => entity.state === "comparing");
                    if (target) {
                        expect(active?.id).toBe(`cell-${target[0]}-${target[1]}`);
                    } else {
                        expect(active).toBeUndefined();
                    }
                });
            }
        }
    });

    it("never overfills a bucket and is deterministic", () => {
        const first = [...mod.run(mod.defaultInput)];
        const second = [...mod.run(mod.defaultInput)];
        expect(first[first.length - 1]?.meta["placed"]).toBe(second[second.length - 1]?.meta["placed"]);
        for (const frame of first) {
            for (const entity of frame.entities) {
                const keys = String(entity.metadata["keys"] ?? "");
                if (keys.length === 0) continue;
                expect(keys.split(",").length).toBeLessThanOrEqual(2);
            }
        }
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
