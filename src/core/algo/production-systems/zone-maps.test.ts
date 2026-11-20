/**
 * zone-maps.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { matches, zoneCanMatch } from "./zone-maps";
import type { VisualFrame } from "@/types";

type Op = ">=" | ">" | "<=" | "<" | "=" | "!=";
type Input = { zones: number[][]; operator: Op; value: number };

function brute(input: Input) {
    const flags = input.zones.map((z) => {
        const min = Math.min(...z);
        const max = Math.max(...z);
        return zoneCanMatch(min, max, input.operator, input.value);
    });
    const matched = input.zones.map((z, i) => flags[i] ? z.filter((v) => matches(v, input.operator, input.value)).length : 0);
    const fullScan = input.zones.flat().filter((v) => matches(v, input.operator, input.value)).length;
    return { flags, matched, total: matched.reduce((a, b) => a + b, 0), fullScan };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Zone Maps", () => {
    it("matches a full brute-force scan for every operator", () => {
        const ops: Op[] = [">=", ">", "<=", "<", "=", "!="];
        for (let seed = 1; seed <= 30; seed += 1) {
            const zones = Array.from({ length: 2 + (seed % 5) }, (_unused, z) =>
                Array.from({ length: 1 + ((seed + z) % 4) }, (_v, i) => ((seed * (i + 1) * (z + 2)) % 17) - 4));
            const op = ops[seed % ops.length]!;
            const value = (seed % 9) - 2;
            const input: Input = { zones, operator: op, value };
            const frames = [...mod.run(input)];
            checkFrames(frames, zones.length);
            const expected = brute(input);
            expect(expected.total).toBe(expected.fullScan);
            const final = frames[frames.length - 1]!.meta;
            expect(final["scannedFlags"]).toEqual(expected.flags.map((f) => (f ? 1 : 0)));
            expect(final["matched"]).toEqual(expected.matched);
            expect(final["totalMatched"]).toBe(expected.fullScan);
        }
    });

    it("skipped zones contain no matching rows", () => {
        const input: Input = { zones: [[1, 3, 5], [7, 9, 11], [2, 4, 6], [12, 15, 18]], operator: ">=", value: 8 };
        const final = [...mod.run(input)][0]!.meta;
        const flags = final["scannedFlags"] as number[];
        const zoneMins = final["zoneMins"] as number[];
        input.zones.forEach((z, i) => {
            if (flags[i] === 0) {
                expect(z.every((v) => !matches(v, input.operator, input.value))).toBe(true);
                expect(Math.min(...z)).toBe(zoneMins[i]);
            }
        });
        expect(flags).toEqual([0, 1, 0, 1]);
    });

    it("handles equality and inequality landmarks", () => {
        expect(zoneCanMatch(5, 5, "=", 5)).toBe(true);
        expect(zoneCanMatch(5, 5, "=", 6)).toBe(false);
        expect(zoneCanMatch(5, 5, "!=", 5)).toBe(false);
        expect(zoneCanMatch(5, 5, "!=", 6)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
