/**
 * uuid-v7.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./uuid-v7";
import type { VisualFrame } from "@/types";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Rebuild the identifier from the rendered parts and decode its timestamp. */
function fromParts(parts: string[]): { uuid: string; timestamp: number } {
    const ts = parts[0]!;
    const hex = ts + parts[1]! + parts[2]! + parts[3]! + parts[4]!;
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    return { uuid, timestamp: parseInt(ts, 16) };
}

describe("UUID Version 7", () => {
    it("emits standards-shaped identifiers with correct version and variant", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!;
        const ids: string[] = [];
        for (let r = 0; r < Number(final.meta["rows"]); r += 1) {
            const parts = Array.from({ length: 5 }, (_, c) =>
                String(final.entities.find((e) => e.id === `cell-${r}-${c}`)?.value ?? ""),
            );
            expect(parts[1]).toBe("7");
            expect(["8", "9", "a", "b"]).toContain(parts[3]);
            const built = fromParts(parts);
            expect(built.uuid).toMatch(UUID_V7);
            ids.push(built.uuid);
        }
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("encodes each supplied timestamp in the leading 48 bits", () => {
        const timestamps = [0, 1700000000000, 1700000000001, 1700000000123];
        const frames = [...mod.run({ timestamps, seed: 7 })];
        const final = frames[frames.length - 1]!;
        for (let r = 0; r < timestamps.length; r += 1) {
            const parts = Array.from({ length: 5 }, (_, c) =>
                String(final.entities.find((e) => e.id === `cell-${r}-${c}`)?.value ?? ""),
            );
            expect(fromParts(parts).timestamp).toBe(timestamps[r]);
        }
    });

    it("sorts identifiers in nondecreasing timestamp order", () => {
        const timestamps = [1700000000002, 1700000000000, 1700000000001];
        const frames = [...mod.run({ timestamps, seed: 1 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["ordered"]).toBe(false);
        const ascending = [...mod.run({ timestamps: [...timestamps].sort((a, b) => a - b), seed: 1 })];
        expect(ascending[ascending.length - 1]?.meta["ordered"]).toBe(true);
    });

    it("is deterministic for a fixed seed and differs across seeds", () => {
        const a = [...mod.run(mod.defaultInput)][0]?.entities.map((e) => e.value);
        const b = [...mod.run(mod.defaultInput)][0]?.entities.map((e) => e.value);
        const c = [...mod.run({ ...(mod.defaultInput as object), seed: 99 })][0]?.entities.map((e) => e.value);
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
