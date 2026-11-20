/**
 * hermite-interpolation.test.ts - Node value and derivative exactness,
 * independent sine cross-check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hermite-interpolation";
import type { VisualFrame, MetaValue } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function numArray(meta: Record<string, MetaValue>, key: string): number[] {
    const raw = meta[key];
    return Array.isArray(raw) ? raw.map((v) => Number(v)) : [];
}

describe("Piecewise cubic Hermite interpolation", () => {
    it("reproduces every supplied node value and derivative exactly", () => {
        const frames = [...mod.run({ samples: 20 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const values = numArray(meta, "values");
        const derivatives = numArray(meta, "derivatives");
        const valueChecks = numArray(meta, "nodeValueChecks");
        const derivativeChecks = numArray(meta, "nodeDerivativeChecks");
        expect(valueChecks.length).toBe(values.length);
        valueChecks.forEach((v, i) => expect(v).toBeCloseTo(values[i]!, 9));
        derivativeChecks.forEach((v, i) => expect(v).toBeCloseTo(derivatives[i]!, 9));
    });

    it("approximates the independent sine function on a fine grid", () => {
        const frames = [...mod.run({ samples: 60 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["maxError"])).toBeLessThan(0.02);
        for (const frame of frames.slice(1, -1)) {
            for (const entity of frame.entities) {
                const m = entity.metadata as Record<string, number>;
                expect(Math.abs(m["interpolated"]! - Math.sin(m["x"]!))).toBeLessThan(0.02);
            }
        }
    });

    it("honors custom nodes with a known quadratic function", () => {
        const nodes = [0, 1, 2, 3];
        const values = nodes.map((x) => x * x);
        const derivatives = nodes.map((x) => 2 * x);
        const frames = [...mod.run({ nodes, values, derivatives, samples: 25, exact: "square" })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["maxError"])).toBeLessThan(1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
