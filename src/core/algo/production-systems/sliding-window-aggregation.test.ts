/** sliding-window-aggregation.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./sliding-window-aggregation";
import type { VisualFrame } from "@/types";

type Aggregate = "sum" | "min" | "max";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function naive(values: number[], width: number, kind: Aggregate): number[] {
    const out: number[] = [];
    for (let end = width - 1; end < values.length; end += 1) {
        const slice = values.slice(end - width + 1, end + 1);
        out.push(kind === "sum" ? slice.reduce((a, b) => a + b, 0) : kind === "min" ? Math.min(...slice) : Math.max(...slice));
    }
    return out;
}

describe("Sliding Window Aggregation", () => {
    it("matches a naive recomputation for all three aggregates", () => {
        const base = mod.defaultInput as { values: number[]; window: number };
        for (const kind of ["sum", "min", "max"] as Aggregate[]) {
            const frames = [...mod.run({ ...base, aggregate: kind })];
            checkFrames(frames);
            const last = frames[frames.length - 1];
            expect(last?.meta["values"]).toEqual(naive(base.values, base.window, kind));
        }
    });

    it("matches brute force over random streams", () => {
        let seed = 777;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const values = Array.from({ length: 1 + rand(20) }, () => rand(50) - 25);
            const width = 1 + rand(Math.max(1, values.length));
            const kind = (["sum", "min", "max"] as Aggregate[])[rand(3)] as Aggregate;
            const frames = [...mod.run({ values, window: width, aggregate: kind })];
            const last = frames[frames.length - 1];
            expect(last?.meta["values"]).toEqual(naive(values, width, kind));
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
