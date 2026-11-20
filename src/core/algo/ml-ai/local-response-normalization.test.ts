/** local-response-normalization.test.ts - Direct reference and property checks. */

import { describe, expect, it } from "vitest";
import mod, { localResponseNormalize, localSquareSums } from "./local-response-normalization";
import type { VisualFrame } from "@/types";

/** Independent direct implementation of local response normalization. */
function reference(values: number[], k: number, alpha: number, beta: number, half: number): number[] {
    return values.map((value, i) => {
        let sum = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j += 1) {
            sum += values[j]! ** 2;
        }
        return value / (k + (alpha / (2 * half + 1)) * sum) ** beta;
    });
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Local Response Normalization", () => {
    it("matches a direct implementation for several window sizes", () => {
        const values = [0.5, 2, 1.5, 0.8, 3];
        for (const half of [0, 1, 2, 3]) {
            const got = localResponseNormalize(values, 1, 1, 0.75, half);
            const expected = reference(values, 1, 1, 0.75, half);
            got.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 10));
        }
    });

    it("preserves zeros and positivity, and stronger alpha suppresses more", () => {
        const values = [0, 1, 2, 1];
        const got = localResponseNormalize(values, 1, 1, 1, 1);
        expect(got[0]).toBeCloseTo(0, 10);
        got.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
        const weak = localResponseNormalize(values, 1, 0.1, 1, 1);
        expect(weak[2]!).toBeGreaterThan(got[2]!);
        expect(localSquareSums(values, 1)[2]).toBe(1 + 4 + 1);
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, input.values.length);
        expect(frames[frames.length - 1]!.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
