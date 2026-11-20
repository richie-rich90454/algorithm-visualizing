/** l-diversity.test.ts - Independent distinct-value brute force, monotonicity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./l-diversity";
import type { VisualFrame } from "@/types";

interface RecordInput { qi: string; sensitive: string; }
interface DiversityInput { records: RecordInput[]; l: number; }

function bruteCounts(records: RecordInput[]): Map<string, number> {
    const groups = new Map<string, Set<string>>();
    for (const record of records) {
        if (!groups.has(record.qi)) groups.set(record.qi, new Set());
        groups.get(record.qi)?.add(record.sensitive);
    }
    const counts = new Map<string, number>();
    for (const [qi, values] of groups) counts.set(qi, values.size);
    return counts;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("l-Diversity Check", () => {
    it("matches a brute-force distinct-value count on the default input", () => {
        const input = mod.defaultInput as DiversityInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const counts = bruteCounts(input.records);
        const groups = final?.["groups"] as string[];
        const moduleCounts = final?.["distinctCounts"] as number[];
        groups.forEach((qi, i) => expect(moduleCounts[i]).toBe(counts.get(qi)));
        const diverse = final?.["diverse"] as number[];
        moduleCounts.forEach((count, i) => expect(diverse[i]).toBe(count >= input.l ? 1 : 0));
    });

    it("verdicts are monotone as l increases", () => {
        const records: RecordInput[] = [
            { qi: "g1", sensitive: "a" },
            { qi: "g1", sensitive: "b" },
            { qi: "g1", sensitive: "c" },
            { qi: "g2", sensitive: "a" },
            { qi: "g2", sensitive: "a" },
        ];
        for (let l = 1; l <= 5; l += 1) {
            const final = [...mod.run({ records, l })].at(-1)?.meta;
            const diverse = final?.["diverse"] as number[];
            expect(diverse[0]).toBe(l <= 3 ? 1 : 0);
            expect(diverse[1]).toBe(l <= 1 ? 1 : 0);
        }
    });

    it("a single sensitive value never satisfies l greater than one", () => {
        const records = Array.from({ length: 6 }, () => ({ qi: "g", sensitive: "x" }));
        expect([...mod.run({ records, l: 2 })].at(-1)?.meta["allDiverse"]).toBe(false);
        expect([...mod.run({ records, l: 1 })].at(-1)?.meta["allDiverse"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
