/**
 * mapreduce.test.ts - Brute-force word count, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./mapreduce";
import type { VisualFrame } from "@/types";

/** Independent reference word count with a plain Map. */
function reference(lines: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const line of lines) {
        for (const word of line.toLowerCase().split(/\s+/)) {
            if (word.length > 0) {
                counts.set(word, (counts.get(word) ?? 0) + 1);
            }
        }
    }
    return counts;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBeGreaterThanOrEqual(1);
        expect(frame.meta["cols"]).toBeGreaterThanOrEqual(1);
    });
}

describe("MapReduce", () => {
    it("matches a brute-force word count on several inputs", () => {
        const cases: string[][] = [
            ["the quick brown fox", "the quick blue fox"],
            ["a a a"],
            ["one", "two", "three"],
            ["Mixed CASE words words"],
        ];
        for (const lines of cases) {
            const frames = [...mod.run({ lines })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const keys = final?.["keys"] as string[];
            const values = final?.["values"] as number[];
            const expected = reference(lines);
            expect(keys.length).toBe(expected.size);
            for (let i = 0; i < keys.length; i += 1) {
                expect(values[i]).toBe(expected.get(keys[i] ?? ""));
            }
            expect(values.reduce((a, b) => a + b, 0)).toBe(
                lines.join(" ").toLowerCase().split(/\s+/).filter(Boolean).length,
            );
        }
    });

    it("emits one map frame per token", () => {
        const lines = ["a b", "c"];
        const frames = [...mod.run({ lines })];
        checkFrames(frames);
        const mapFrames = frames.filter((f) => f.meta["phase"] === "map");
        expect(mapFrames.length).toBe(3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
