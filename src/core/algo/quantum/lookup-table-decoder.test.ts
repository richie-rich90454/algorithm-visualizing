/**
 * lookup-table-decoder.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lookup-table-decoder";
import type { VisualFrame } from "@/types";

function syndromeOf(errors: number[]): [number, number] {
    return [(errors[0] ?? 0) ^ (errors[1] ?? 0), (errors[1] ?? 0) ^ (errors[2] ?? 0)];
}

/** Independent exhaustive table over all eight error patterns. */
function referenceTable(): Map<string, number[]> {
    const table = new Map<string, number[]>();
    for (let mask = 0; mask < 8; mask += 1) {
        const errors = [0, 1, 2].map((q) => (mask >> q) & 1);
        const key = syndromeOf(errors).join("");
        const weight = errors.reduce((s, b) => s + b, 0);
        const existing = table.get(key);
        if (!existing || weight < existing.reduce((s, b) => s + b, 0)) table.set(key, errors);
    }
    return table;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lookup Table Decoder", () => {
    it("decodes all four syndromes of the three-qubit code", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const table = referenceTable();
        const all = [[0, 0], [1, 1], [1, 0], [0, 1]];
        const lookups = frames.slice(1, -1);
        expect(lookups).toHaveLength(all.length);
        lookups.forEach((frame, i) => {
            const key = all[i]!.join("");
            const correction = frame.meta["correction"] as number[];
            expect(correction).toEqual(table.get(key));
            expect(syndromeOf(correction)).toEqual([all[i]![0], all[i]![1]]);
        });
    });

    it("stores minimum-weight corrections for every syndrome", () => {
        const table = referenceTable();
        expect([...table.keys()].sort()).toEqual(["00", "01", "10", "11"]);
        for (const [key, correction] of table) {
            expect(correction.reduce((s, b) => s + b, 0)).toBeLessThanOrEqual(1);
            expect(syndromeOf(correction).join("")).toBe(key);
        }
    });

    it("handles repeated syndromes without losing the mapping", () => {
        const syndromes = [[1, 0], [0, 1], [1, 0], [0, 0]];
        const frames = [...mod.run({ syndromes })];
        const lookups = frames.slice(1, -1);
        expect(lookups.map((f) => f.meta["correction"])).toEqual([
            [1, 0, 0],
            [0, 0, 1],
            [1, 0, 0],
            [0, 0, 0],
        ]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
