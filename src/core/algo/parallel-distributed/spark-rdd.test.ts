/**
 * spark-rdd.test.ts - Independent lineage reference, recovery exactness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./spark-rdd";
import type { VisualFrame } from "@/types";

type Input = { partitions: number[][]; ops: string[]; lostPartition: number };

function applyOp(values: number[], op: string): number[] {
    if (op === "double") return values.map((v) => v * 2);
    if (op === "plusOne") return values.map((v) => v + 1);
    if (op === "filterEven") return values.filter((v) => v % 2 === 0);
    if (op === "square") return values.map((v) => v * v);
    return values;
}

function reference(input: Input): number[] {
    let values = [...(input.partitions[input.lostPartition] ?? [])];
    for (const op of input.ops) values = applyOp(values, op);
    return values;
}

function checkFrames(frames: VisualFrame[], input: Input): void {
    expect(frames.length).toBe(input.ops.length + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(input.ops.length + 1);
        expect(frame.meta["cols"]).toBe(input.partitions.length);
        expect(frame.entities.length).toBe((input.ops.length + 1) * input.partitions.length);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["original"] as number[]).length).toBeGreaterThanOrEqual(0);
    });
}

describe("SparkRdd", () => {
    it("recovers each lost partition exactly", () => {
        const cases: Input[] = [
            { partitions: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], ops: ["double", "filterEven"], lostPartition: 1 },
            { partitions: [[1, 2], [3, 4]], ops: ["plusOne", "square"], lostPartition: 0 },
            { partitions: [[1, 2, 3, 4]], ops: ["filterEven", "double", "plusOne"], lostPartition: 0 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(input);
            expect(final?.["ok"]).toBe(true);
            expect(final?.["original"]).toEqual(expected);
            expect(final?.["recovered"]).toEqual(expected);
        }
    });

    it("reports a mismatch only when lineage changes between stages", () => {
        const input: Input = { partitions: [[1, 2, 3]], ops: ["double", "filterEven"], lostPartition: 0 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["ok"]).toBe(true);
        expect(final?.["phase"]).toBe("recovered");
        expect(frames[1]?.meta["phase"]).toBe("lost");
    });

    it("clamps an invalid lost partition index", () => {
        const frames = [...mod.run({ partitions: [[1, 2], [3, 4]], ops: ["square"], lostPartition: 99 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["lostPartition"]).toBe(1);
        expect(final?.["ok"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
