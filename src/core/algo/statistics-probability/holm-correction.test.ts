/**
 * holm-correction.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./holm-correction";
import type { VisualFrame } from "@/types";

/** Independent reference implementation of Holm's step-down procedure. */
function reference(pValues: number[], alpha: number): { rejected: number[]; adjusted: number[] } {
    const m = pValues.length;
    const order = pValues.map((p, index) => ({ p, index })).sort((a, b) => a.p - b.p || a.index - b.index);
    const rejected: number[] = [];
    let stop = m;
    for (let rank = 0; rank < m; rank += 1) {
        const entry = order[rank]!;
        if (entry.p > alpha / (m - rank)) {
            stop = rank;
            break;
        }
    }
    for (let rank = 0; rank < stop; rank += 1) {
        rejected.push(order[rank]!.index);
    }
    const adjusted = new Array<number>(m).fill(1);
    let running = 0;
    for (let rank = 0; rank < m; rank += 1) {
        const entry = order[rank]!;
        running = Math.max(running, (m - rank) * entry.p);
        adjusted[entry.index] = Math.min(1, running);
    }
    return { rejected: rejected.sort((a, b) => a - b), adjusted };
}

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(m);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.edges.length).toBe(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Holm correction", () => {
    it("matches an independent reference across several inputs", () => {
        const cases = [
            { p: [0.01, 0.04, 0.03, 0.2, 0.005], alpha: 0.05 },
            { p: [0.001, 0.008, 0.039, 0.041, 0.042, 0.06], alpha: 0.05 },
            { p: [0.5, 0.9, 0.2], alpha: 0.1 },
            { p: [0.0001, 0.0002], alpha: 0.01 },
        ];
        for (const { p, alpha } of cases) {
            const frames = [...mod.run({ pValues: p, alpha })];
            checkFrames(frames, p.length);
            const final = frames[frames.length - 1]!.meta;
            const expected = reference(p, alpha);
            expect(final["rejected"]).toEqual(expected.rejected);
            const adjusted = final["adjustedPValues"] as number[];
            expect(adjusted.length).toBe(p.length);
            for (let i = 0; i < p.length; i += 1) {
                expect(adjusted[i]).toBeCloseTo(expected.adjusted[i] as number, 10);
                expect(adjusted[i] as number).toBeGreaterThanOrEqual(p[i] as number);
                expect(adjusted[i] as number).toBeLessThanOrEqual(1);
            }
        }
    });

    it("adjusted p values are monotone in the sorted order", () => {
        const p = [0.3, 0.01, 0.2, 0.04, 0.005, 0.5];
        const frames = [...mod.run({ pValues: p, alpha: 0.05 })];
        const final = frames[frames.length - 1]!.meta;
        const order = final["order"] as number[];
        const adjusted = final["adjustedPValues"] as number[];
        for (let i = 1; i < order.length; i += 1) {
            expect(adjusted[order[i] as number] as number).toBeGreaterThanOrEqual(adjusted[order[i - 1] as number] as number);
        }
    });

    it("rejects at least every Bonferroni rejection", () => {
        const p = [0.001, 0.01, 0.02, 0.2];
        const alpha = 0.05;
        const frames = [...mod.run({ pValues: p, alpha })];
        const rejected = new Set(frames[frames.length - 1]!.meta["rejected"] as number[]);
        for (let i = 0; i < p.length; i += 1) {
            if ((p[i] as number) <= alpha / p.length) {
                expect(rejected.has(i)).toBe(true);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
