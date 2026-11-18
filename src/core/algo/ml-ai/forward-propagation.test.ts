/** forward-propagation.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./forward-propagation";
import type { VisualFrame } from "@/types";

/** Independent forward pass through the same fixed network. */
function reference(x: number[]) {
    const z1 = [
        0.1 * x[0]! + 0.2 * x[1]! + 0.05,
        0.3 * x[0]! + 0.4 * x[1]! + 0.05,
    ];
    const hidden = z1.map((v) => Math.max(0, v));
    const z2 = 0.5 * hidden[0]! - 0.5 * hidden[1]! + 0.1;
    const output = 1 / (1 + Math.exp(-z2));
    return { z1, hidden, z2, output };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Forward propagation", () => {
    it("matches an independent forward pass on several inputs", () => {
        const inputs = [
            [0.5, 0.8],
            [-1, 2],
            [0, 0],
            [3, -4],
        ];
        for (const x of inputs) {
            const frames = [...mod.run({ x })];
            checkFrames(frames);
            const expected = reference(x);
            const finalMeta = frames[frames.length - 1]?.meta;
            const hidden = finalMeta?.["hidden"] as number[] | undefined;
            expect(hidden?.length).toBe(2);
            expect(hidden?.[0]).toBeCloseTo(expected.hidden[0]!, 4);
            expect(hidden?.[1]).toBeCloseTo(expected.hidden[1]!, 4);
            expect(Number(finalMeta?.["z2"])).toBeCloseTo(expected.z2, 4);
            expect(Number(finalMeta?.["output"])).toBeCloseTo(expected.output, 4);
        }
    });

    it("computes hidden neurons before the output", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames.slice(2, 4)) {
            const hidden = frame.meta["hidden"] as number[];
            expect(hidden.every((v) => typeof v === "number")).toBe(true);
        }
        const finalMeta = frames[frames.length - 1]?.meta;
        expect((finalMeta?.["hidden"] as number[]).every((v) => v >= 0)).toBe(true);
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
