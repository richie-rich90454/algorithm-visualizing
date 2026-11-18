/**
 * apache-kafka-log-segment-retention.test.ts - Independent retention reference,
 * budget and ordering properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./apache-kafka-log-segment-retention";
import type { VisualFrame } from "@/types";

interface Segment {
    baseOffset: number;
    sizeBytes: number;
    maxTimestamp: number;
}

interface Input {
    segments: Segment[];
    retentionBytes: number;
    retentionMs: number;
    now: number;
}

function checkFrames(frames: VisualFrame[], segments: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(segments);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.entities.every((entity) => entity.metadata["row"] === 0)).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent two-policy retention reference. */
function reference(input: Input): { kept: number[]; deleted: number[]; total: number } {
    const sorted = [...input.segments].sort((a, b) => a.baseOffset - b.baseOffset);
    const cutoff = input.now - input.retentionMs;
    const deleted = new Set<number>();
    let total = sorted.reduce((sum, segment) => sum + segment.sizeBytes, 0);
    for (let i = 0; i < sorted.length; i += 1) {
        if (sorted[i]!.maxTimestamp < cutoff) {
            deleted.add(i);
            total -= sorted[i]!.sizeBytes;
        }
    }
    for (let i = 0; i < sorted.length; i += 1) {
        if (deleted.has(i)) {
            continue;
        }
        if (total <= input.retentionBytes) {
            break;
        }
        deleted.add(i);
        total -= sorted[i]!.sizeBytes;
    }
    return {
        kept: sorted.filter((_, i) => !deleted.has(i)).map((segment) => segment.baseOffset),
        deleted: sorted.filter((_, i) => deleted.has(i)).map((segment) => segment.baseOffset),
        total,
    };
}

describe("Kafka log segment retention", () => {
    it("matches an independent retention reference", () => {
        const cases: Input[] = [
            {
                segments: [
                    { baseOffset: 0, sizeBytes: 300, maxTimestamp: 1000 },
                    { baseOffset: 10, sizeBytes: 400, maxTimestamp: 4000 },
                    { baseOffset: 20, sizeBytes: 350, maxTimestamp: 6000 },
                    { baseOffset: 30, sizeBytes: 400, maxTimestamp: 9000 },
                ],
                retentionBytes: 600,
                retentionMs: 5000,
                now: 10000,
            },
            {
                segments: [
                    { baseOffset: 5, sizeBytes: 100, maxTimestamp: 900 },
                    { baseOffset: 15, sizeBytes: 100, maxTimestamp: 950 },
                ],
                retentionBytes: 1000,
                retentionMs: 5000,
                now: 10000,
            },
            {
                segments: [
                    { baseOffset: 0, sizeBytes: 50, maxTimestamp: 100 },
                    { baseOffset: 1, sizeBytes: 50, maxTimestamp: 200 },
                    { baseOffset: 2, sizeBytes: 50, maxTimestamp: 300 },
                ],
                retentionBytes: 0,
                retentionMs: 100000,
                now: 10000,
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.segments.length);
            const want = reference(input);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["keptOffsets"]).toEqual(want.kept);
            expect(last?.["deletedOffsets"]).toEqual(want.deleted);
            expect(Number(last?.["totalSize"])).toBe(want.total);
            expect(want.kept).toEqual([...want.kept].sort((a, b) => a - b));
        }
    });

    it("respects the byte budget and the age cutoff", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.segments.length);
        const last = frames[frames.length - 1]?.meta;
        const kept = last?.["keptOffsets"] as number[];
        const sizes = last?.["sizes"] as number[];
        const offsets = last?.["baseOffsets"] as number[];
        const ages = last?.["ages"] as number[];
        let keptSize = 0;
        for (let i = 0; i < offsets.length; i += 1) {
            if (kept.includes(offsets[i]!)) {
                keptSize += sizes[i]!;
                expect(ages[i]!).toBeLessThan(Number(last?.["retentionMs"]));
            }
        }
        expect(keptSize).toBeLessThanOrEqual(Number(last?.["retentionBytes"]));
        expect(kept).toEqual([30]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
