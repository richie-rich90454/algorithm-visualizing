/**
 * maglev-hashing.test.ts - Independent table construction, balance, minimal
 * disruption, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./maglev-hashing";
import type { VisualFrame } from "@/types";

function hash(name: string, seed: number): number {
    let h = seed >>> 0;
    for (let i = 0; i < name.length; i += 1) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
    return h >>> 0;
}

/** Independent reference build using an explicit per-backend probe counter. */
function referenceTable(backends: string[], size: number): Array<string | null> {
    const slots: Array<string | null> = Array<string | null>(size).fill(null);
    const starts = backends.map((b) => hash(b, 2166136261) % size);
    const steps = backends.map((b) => (hash(b, 0x9e3779b9) % (size - 1)) + 1);
    const probes = backends.map(() => 0);
    let assigned = 0;
    while (assigned < size) {
        for (let b = 0; b < backends.length && assigned < size; b += 1) {
            let candidate = (starts[b] + probes[b] * steps[b]) % size;
            while (slots[candidate] !== null) {
                probes[b] += 1;
                candidate = (starts[b] + probes[b] * steps[b]) % size;
            }
            slots[candidate] = backends[b];
            probes[b] += 1;
            assigned += 1;
        }
    }
    return slots;
}

function finalTable(frames: VisualFrame[]): Array<string | null> {
    const entities = frames[frames.length - 1]?.entities ?? [];
    const result: Array<string | null> = [];
    for (const entity of entities) {
        result[Number(entity.metadata["col"])] = String(entity.metadata["backend"] || "") || null;
    }
    return result;
}

function checkFrames(frames: VisualFrame[], size: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(size);
        expect(frame.entities.every((e) => e.type === "cell" && e.metadata["col"] !== undefined)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Maglev Consistent Hashing", () => {
    it("matches an independent table build and fills every slot", () => {
        const input = mod.defaultInput as { backends: string[]; tableSize: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tableSize);
        const actual = finalTable(frames);
        const expected = referenceTable(input.backends, input.tableSize);
        expect(actual).toEqual(expected);
        expect(actual.every((slot) => slot !== null)).toBe(true);
        expect(new Set(actual).size).toBe(input.backends.length);
    });

    it("balances backends to within one slot and is deterministic", () => {
        const backends = ["a", "b", "c", "d", "e"];
        const size = 101;
        const frames = [...mod.run({ backends, tableSize: size })];
        checkFrames(frames, size);
        const table = finalTable(frames);
        const counts = backends.map((b) => table.filter((slot) => slot === b).length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        const again = [...mod.run({ backends, tableSize: size })];
        expect(finalTable(again)).toEqual(table);
    });

    it("keeps disruption bounded and removes the failed backend", () => {
        const backends = ["alpha", "beta", "gamma", "delta"];
        const size = 31;
        const before = finalTable([...mod.run({ backends, tableSize: size })]);
        const survivorSet = backends.slice(0, 3);
        const after = finalTable([...mod.run({ backends: survivorSet, tableSize: size })]);
        expect(after.every((slot) => slot !== null && slot !== "delta")).toBe(true);
        let changed = 0;
        for (let i = 0; i < size; i += 1) {
            if (before[i] !== after[i]) changed += 1;
        }
        // Removing one of four backends disrupts roughly a quarter of the
        // table plus a few collision-driven shifts; well under half.
        expect(changed).toBeLessThan(size / 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, 13);
        expect(generator.next().done).toBe(true);
    });
});
