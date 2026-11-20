/**
 * lambda-architecture.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lambda-architecture";
import type { VisualFrame } from "@/types";

interface Datum { key: string; value: number }
function brute(records: Datum[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of records) { out[r.key] = (out[r.key] ?? 0) + r.value; }
    return out;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lambda architecture layers", () => {
    it("merged view equals brute-force aggregation over all records", () => {
        const cases = [
            {
                batchData: [{ key: "a", value: 2 }, { key: "b", value: 3 }, { key: "a", value: 5 }],
                streamData: [{ key: "a", value: 1 }, { key: "c", value: 4 }, { key: "b", value: 2 }],
                queryKey: "a",
            },
            {
                batchData: [{ key: "x", value: 10 }],
                streamData: [{ key: "x", value: -3 }, { key: "y", value: 7 }],
                queryKey: "y",
            },
            { batchData: [], streamData: [], queryKey: "z" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["merged"]).toEqual(brute([...input.batchData, ...input.streamData]));
            expect(meta?.["answer"]).toBe((brute([...input.batchData, ...input.streamData])[input.queryKey] ?? 0));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
