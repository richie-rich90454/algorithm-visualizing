/**
 * kappa-architecture.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kappa-architecture";
import type { VisualFrame } from "@/types";

interface Event { key: string; value: number }
function brute(events: Event[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of events) { out[e.key] = (out[e.key] ?? 0) + e.value; }
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

describe("Kappa architecture reprocessing", () => {
    it("reprocessed view matches live view and brute force", () => {
        const cases = [
            { events: [{ key: "page", value: 1 }, { key: "page", value: 1 }, { key: "cart", value: 1 }, { key: "page", value: 1 }], queryKey: "page" },
            { events: [{ key: "a", value: 3 }, { key: "b", value: -2 }, { key: "a", value: 5 }], queryKey: "a" },
            { events: [], queryKey: "none" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const expected = brute(input.events);
            expect(meta?.["view"]).toEqual(expected);
            expect(meta?.["reprocessed"]).toEqual(expected);
            expect(meta?.["matches"]).toBe(true);
            expect(meta?.["answer"]).toBe(expected[input.queryKey] ?? 0);
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
