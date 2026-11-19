/**
 * ddsketch.test.ts - Correctness and frame checks for DDSketch.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./ddsketch";

function drain(input: unknown): VisualFrame[] {
    const out: VisualFrame[] = [];
    for (const frame of mod.run(input)) out.push(frame);
    return out;
}

function checkShapes(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.metadata).toHaveProperty("row");
            expect(entity.metadata).toHaveProperty("col");
        }
    });
}

function exactQuantile(sorted: number[], q: number): number {
    return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
}

describe("DDSketch", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("keeps every quantile within the stated relative error of the brute-force value", () => {
        for (const values of [
            [1.1, 1.5, 2.2, 3.1, 4.7, 6.3, 8.8, 12.4, 18.1, 26.7, 40.2, 61.5],
            [0.5, 0.7, 0.9, 1.2, 2.4, 5.6, 9.8, 17.3],
            [100, 110, 130, 160, 210, 380, 900],
        ]) {
            const qs = [0.5, 0.9, 0.99];
            const frames = drain({ values, quantiles: qs, alpha: 0.01 });
            const final = frames[frames.length - 1];
            const sorted = [...values].sort((a, b) => a - b);
            const approx = final?.meta.approx as number[];
            expect(approx.length).toBe(qs.length);
            approx.forEach((estimate, i) => {
                const truth = exactQuantile(sorted, qs[i] ?? 0);
                expect(Math.abs(estimate - truth) / truth).toBeLessThan(0.05);
            });
            expect(final?.meta.maxRelError).toBeLessThan(0.05);
        }
    });

    it("counts every added value into buckets", () => {
        const frames = drain(mod.defaultInput);
        const final = frames[frames.length - 1];
        expect(final?.meta.values).toBe((mod.defaultInput as { values: number[] }).values.length);
        expect((final?.meta.buckets as number)).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBe((mod.defaultInput as { values: number[] }).values.length + 2);
        expect(gen.next().done).toBe(true);
    });
});
