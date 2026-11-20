/**
 * true-time-clock.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./true-time-clock";
import type { VisualFrame } from "@/types";

interface Spec {
    node?: string;
    offset?: number;
    uncertainty?: number;
}

/** Independent TrueTime replay. */
function reference(specs: Spec[]): Array<{ assigned: number; wait: number; ack: number }> {
    let real = 0;
    const out: Array<{ assigned: number; wait: number; ack: number }> = [];
    for (const spec of specs) {
        const e = typeof spec.uncertainty === "number" && spec.uncertainty > 0 ? spec.uncertainty : 1;
        const raw = typeof spec.offset === "number" ? spec.offset : 0;
        const d = Math.max(-e / 2, Math.min(e / 2, raw));
        const assigned = real + d + e;
        const wait = 2 * e;
        const ack = real + wait;
        out.push({ assigned, wait, ack });
        real = ack;
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("TrueTime Clock", () => {
    it("assigns strictly increasing timestamps under commit wait", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["ordered"]).toBe(true);
        const rows = frames.slice(1, -1).map((frame) => {
            const r = Number(frame.meta["rows"]) - 1;
            return Number(frame.entities.find((e) => e.id === `cell-${r}-4`)?.value);
        });
        expect(rows.length).toBeGreaterThan(1);
        for (let i = 1; i < rows.length; i += 1) {
            expect(rows[i]!).toBeGreaterThan(rows[i - 1]!);
        }
    });

    it("matches an independent replay and uses a wait of twice the uncertainty", () => {
        const specs = (mod.defaultInput as { transactions: Spec[] }).transactions;
        const expected = reference(specs);
        const frames = [...mod.run(mod.defaultInput)];
        const trace = frames.slice(1, -1);
        expect(trace).toHaveLength(expected.length);
        trace.forEach((frame, i) => {
            const cells = frame.entities;
            const assigned = Number(cells.find((e) => e.id === `cell-${i}-4`)?.value);
            const wait = Number(cells.find((e) => e.id === `cell-${i}-5`)?.value);
            const ack = Number(cells.find((e) => e.id === `cell-${i}-6`)?.value);
            expect(assigned).toBeCloseTo(expected[i]!.assigned, 10);
            expect(wait).toBeCloseTo(expected[i]!.wait, 10);
            expect(ack).toBeCloseTo(expected[i]!.ack, 10);
            expect(wait).toBeCloseTo(2 * (specs[i]?.uncertainty ?? 1), 10);
        });
    });

    it("keeps the interval ordered earliest before latest in every row", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames.slice(1, -1)) {
            const r = Number(frame.meta["rows"]) - 1;
            const earliest = Number(frame.entities.find((e) => e.id === `cell-${r}-2`)?.value);
            const latest = Number(frame.entities.find((e) => e.id === `cell-${r}-3`)?.value);
            expect(earliest).toBeLessThanOrEqual(latest);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
