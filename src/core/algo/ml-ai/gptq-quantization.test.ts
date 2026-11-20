/** gptq-quantization.test.ts - Error feedback, grid membership, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./gptq-quantization";
import type { VisualFrame } from "@/types";

interface Input {
    weights: number[];
    hessian: number[][];
    bits: number;
}

/** Independent Gauss-Jordan inverse used only to verify the module's loop. */
function inverse(m: number[][]): number[][] {
    const n = m.length;
    const a = m.map((row, i) => row.slice().concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c += 1) {
        let p = c;
        for (let r = c + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[c] ?? 0) > Math.abs(a[p]?.[c] ?? 0)) p = r;
        }
        [a[c], a[p]] = [a[p] as number[], a[c] as number[]];
        const d = a[c]?.[c] ?? 1;
        for (let k = 0; k < 2 * n; k += 1) a[c]![k] = (a[c]![k] ?? 0) / d;
        for (let r = 0; r < n; r += 1) {
            if (r === c) continue;
            const f = a[r]?.[c] ?? 0;
            for (let k = 0; k < 2 * n; k += 1) a[r]![k] = (a[r]![k] ?? 0) - f * (a[c]![k] ?? 0);
        }
    }
    return a.map((row) => row.slice(n));
}

function referenceGptq(weights: number[], hessian: number[][], bits: number): number[] {
    const n = weights.length;
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const levels = Math.pow(2, bits) - 1;
    const scale = (max - min) / levels;
    const hinv = inverse(hessian);
    const error = Array(n).fill(0) as number[];
    const q = Array(n).fill(0) as number[];
    for (let i = 0; i < n; i += 1) {
        const corrected = (weights[i] ?? 0) + (error[i] ?? 0);
        const step = Math.max(0, Math.min(levels, Math.round((corrected - min) / scale)));
        q[i] = step * scale + min;
        const comp = (corrected - (q[i] ?? 0)) / (hinv[i]?.[i] ?? 1);
        for (let j = i + 1; j < n; j += 1) {
            error[j] = (error[j] ?? 0) + comp * (hinv[i]?.[j] ?? 0);
        }
    }
    return q;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("GPTQ Quantization", () => {
    it("matches an independent replay of the error-feedback loop", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.weights.length);
        const got = frames[frames.length - 1]?.meta["quantized"] as number[];
        const expected = referenceGptq(input.weights, input.hessian, input.bits);
        got.forEach((value, i) => {
            expect(value).toBeCloseTo(expected[i] ?? 0, 9);
        });
    });

    it("places every quantized value exactly on the uniform grid", () => {
        for (const bits of [1, 2, 3]) {
            const input = { ...(mod.defaultInput as Input), bits };
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta;
            const scale = final?.["scale"] as number;
            const zp = final?.["zeroPoint"] as number;
            const q = final?.["quantized"] as number[];
            const levels = Math.pow(2, bits) - 1;
            q.forEach((value) => {
                const step = Math.round((value - zp) / scale);
                expect(step).toBeGreaterThanOrEqual(0);
                expect(step).toBeLessThanOrEqual(levels);
                expect(value).toBeCloseTo(step * scale + zp, 9);
            });
        }
    });

    it("reduces exactly to round-to-nearest for a diagonal Hessian", () => {
        const input = mod.defaultInput as Input;
        const n = input.weights.length;
        const identity = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
        );
        const frames = [...mod.run({ ...input, hessian: identity })];
        checkFrames(frames, n);
        const got = frames[frames.length - 1]?.meta["quantized"] as number[];
        const reference = referenceGptq(input.weights, identity, input.bits);
        got.forEach((value, i) => {
            expect(value).toBeCloseTo(reference[i] ?? 0, 9);
        });
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
