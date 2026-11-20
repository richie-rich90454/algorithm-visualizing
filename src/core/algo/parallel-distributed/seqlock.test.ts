/**
 * seqlock.test.ts - Torn-snapshot detection, accepted-value correctness,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./seqlock";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function matrix(meta: Record<string, MetaValue>, key: string): number[][] {
    const raw = meta[key];
    return Array.isArray(raw)
        ? raw.map((row) => (row as MetaValue[]).map((v) => Number(v)))
        : [];
}

describe("Sequence lock", () => {
    it("accepts only complete writer values, never a torn mixture", () => {
        const initial = [1, 2, 3];
        const updates = [[4, 5, 6], [7, 8, 9], [10, 11, 12]];
        const frames = [...mod.run({ initial, updates })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const accepted = matrix(final, "accepted");
        const valid = [initial, ...updates].map((v) => v.join(","));
        expect(accepted.length).toBe(updates.length);
        for (const snap of accepted) {
            expect(valid).toContain(snap.join(","));
        }
        expect(Number(final["retries"])).toBe(updates.length);
        expect(Number(final["reads"])).toBe(updates.length);
    });

    it("marks a snapshot valid only on an even stable sequence", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const ok = frame.meta["snapshotValid"];
            if (ok === true) expect(Number(frame.meta["sequence"]) % 2).toBe(0);
            if (ok === false) {
                expect(frame.meta["phase"]).toBe("retry");
                expect(Number(frame.meta["sequence"]) % 2).toBe(0);
            }
        }
    });

    it("keeps the writer data consistent with the latest update", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta["data"] as MetaValue[];
        expect(last.map(Number)).toEqual([7, 8, 9]);
        expect(Number(frames[frames.length - 1]!.meta["sequence"])).toBe(4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
