/** mamba-selective-state-space.test.ts - Recurrence, selectivity, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./mamba-selective-state-space";
import type { VisualFrame } from "@/types";

interface Input {
    sequence: number[];
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Mamba Selective State Space", () => {
    it("matches an independent sequential recurrence", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.sequence.length);
        const outputs = frames[frames.length - 1]?.meta["outputs"] as number[];
        let h = 0;
        input.sequence.forEach((x, i) => {
            const delta = 1 / (1 + Math.exp(-x));
            const decay = Math.exp(-delta);
            h = decay * h + delta * x;
            expect(outputs[i]).toBeCloseTo(h, 12);
        });
    });

    it("keeps delta and decay in (0,1) and makes them depend on the input", () => {
        for (const x of [-5, -1, 0, 1, 5]) {
            const frames = [...mod.run({ sequence: [x] })];
            const delta = frames[1]?.meta["delta"] as number;
            const decay = frames[1]?.meta["decay"] as number;
            const expectedDelta = 1 / (1 + Math.exp(-x));
            expect(delta).toBeCloseTo(expectedDelta, 12);
            expect(delta).toBeGreaterThan(0);
            expect(delta).toBeLessThan(1);
            expect(decay).toBeCloseTo(Math.exp(-delta), 12);
            expect(decay).toBeLessThan(1);
        }
        const small = [...mod.run({ sequence: [0.1] })][1]?.meta["delta"] as number;
        const large = [...mod.run({ sequence: [3] })][1]?.meta["delta"] as number;
        expect(large).toBeGreaterThan(small);
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
