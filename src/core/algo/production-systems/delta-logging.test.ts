/** delta-logging.test.ts - Replay equivalence, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./delta-logging";
import type { VisualFrame } from "@/types";

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
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

/** Simple deterministic pseudo-random generator for reproducible cases. */
function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("delta logging", () => {
    it("redo matches direct writes and undo matches the base on many random inputs", () => {
        const random = rng(20261119);
        const keys = ["A", "B", "C", "D"];
        for (let trial = 0; trial < 60; trial += 1) {
            const pages: Record<string, number> = {};
            for (const key of keys) pages[key] = Math.floor(random() * 100);
            const writes: Array<{ page: string; value: number }> = [];
            const count = 1 + Math.floor(random() * 12);
            for (let i = 0; i < count; i += 1) {
                writes.push({ page: keys[Math.floor(random() * keys.length)] as string, value: Math.floor(random() * 100) });
            }
            const frames = [...mod.run({ pages, writes })];
            checkFrames(frames);
            const meta = finalMeta(frames);

            const expected = { ...pages };
            for (const w of writes) expected[w.page] = w.value;
            const committed = Object.fromEntries((meta["committed"] as string[]).map((e) => e.split(":")));
            const restored = Object.fromEntries((meta["restored"] as string[]).map((e) => e.split(":")));
            const base = Object.fromEntries((meta["base"] as string[]).map((e) => e.split(":")));
            for (const key of keys) {
                expect(Number(committed[key])).toBe(expected[key]);
                expect(Number(restored[key])).toBe(pages[key]);
                expect(Number(base[key])).toBe(pages[key]);
            }
            expect((meta["log"] as string[]).length).toBe(writes.length);
        }
    });

    it("records the correct before value for repeated writes to one page", () => {
        const frames = [...mod.run({ pages: { X: 0 }, writes: [{ page: "X", value: 1 }, { page: "X", value: 2 }, { page: "X", value: 3 }] })];
        expect(finalMeta(frames)["log"]).toEqual(["X:0->1", "X:1->2", "X:2->3"]);
        expect(finalMeta(frames)["restored"]).toEqual(["X:0"]);
        expect(finalMeta(frames)["committed"]).toEqual(["X:3"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
