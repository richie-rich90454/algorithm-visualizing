import { describe, expect, it } from "vitest";
import mod, { kanonymize } from "./k-anonymity";
import type { VisualFrame } from "@/types";

/** Independent brute-force grouping of generalized records. */
function bruteClasses(records: number[][], k: number, width: number): { kept: number[]; suppressed: number[] } {
    const generalized = records.map((row) => row.map((value) => Math.floor(value / width) * width));
    const buckets = new Map<string, number[]>();
    generalized.forEach((row, i) => {
        const key = row.join("|");
        buckets.set(key, [...(buckets.get(key) ?? []), i]);
    });
    const kept: number[] = [];
    const suppressed: number[] = [];
    for (const members of buckets.values()) {
        (members.length >= k ? kept : suppressed).push(...members);
    }
    return { kept: kept.sort((a, b) => a - b), suppressed: suppressed.sort((a, b) => a - b) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 7);
        expect(frame.meta).toBeDefined();
    });
}

describe("k-Anonymity", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["satisfies"]).toBe(true);
        expect(Number(last?.meta["suppressed"])).toBe(1);
        expect(generator.next().done).toBe(true);
    });

    it("matches a brute-force grouping on randomized tables", () => {
        let seed = 97531;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const count = 1 + rand(20);
            const records = Array.from({ length: count }, () => [rand(6), rand(4)]);
            const k = 1 + rand(4);
            const width = 1 + rand(5);
            const result = kanonymize(records, k, width);
            const expected = bruteClasses(records, k, width);
            expect(result.kept).toEqual(expected.kept);
            expect(result.suppressed).toEqual(expected.suppressed);
            expect(result.satisfies).toBe(true);
            const suppressedSet = new Set(result.suppressed);
            const released = result.kept.map((i) => result.generalized[i]?.join(","));
            for (const tuple of released) {
                expect(released.filter((value) => value === tuple).length).toBeGreaterThanOrEqual(k);
            }
            expect([...result.groups.values()].every((members) => members.length >= k || members.every((m) => suppressedSet.has(m)))).toBe(true);
        }
    });

    it("suppresses every record when k exceeds the table size", () => {
        const result = kanonymize([[1, 2], [3, 4]], 10, 1);
        expect(result.kept).toEqual([]);
        expect(result.suppressed).toEqual([0, 1]);
        expect(result.satisfies).toBe(true);
    });
});
