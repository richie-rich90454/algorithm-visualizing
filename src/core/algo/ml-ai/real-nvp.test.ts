/** real-nvp.test.ts - Brute-force coupling math, invertibility, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./real-nvp";
import type { VisualFrame } from "@/types";

interface Layer {
    scale: number;
    shift: number;
    flip: boolean;
}
interface Input {
    x: number[];
    layers: Layer[];
}

/** Independent reference implementation of the forward coupling map. */
function reference(input: Input) {
    let vector = input.x.slice(0, 2);
    while (vector.length < 2) {
        vector.push(0);
    }
    let logDet = 0;
    for (const layer of input.layers) {
        const copyIndex = layer.flip ? 1 : 0;
        const transformIndex = layer.flip ? 0 : 1;
        const copied = vector[copyIndex] ?? 0;
        const s = layer.scale * copied;
        const t = layer.shift * copied;
        vector[transformIndex] = (vector[transformIndex] ?? 0) * Math.exp(s) + t;
        logDet += s;
    }
    return { vector, logDet };
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dim);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RealNVP affine coupling", () => {
    const cases: Input[] = [
        { x: [1, 2], layers: [{ scale: 0.4, shift: 0.2, flip: false }, { scale: -0.3, shift: 0.5, flip: true }] },
        { x: [-2, 0.5], layers: [{ scale: 0, shift: 0, flip: false }] },
        { x: [3, -1], layers: [{ scale: 0.7, shift: -0.4, flip: true }, { scale: 0.2, shift: 0.9, flip: false }, { scale: -0.5, shift: 0.1, flip: true }] },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force forward pass and log determinant", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, 2);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            const out = final?.["vector"] as number[];
            out.forEach((value, i) => expect(value).toBeCloseTo(expected.vector[i]!, 6));
            expect(Number(final?.["logDet"])).toBeCloseTo(expected.logDet, 6);
        }
    });

    it("is exactly invertible by reversing the layers", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta;
            expect(Boolean(final?.["converged"])).toBe(true);
            expect(Number(final?.["inverseError"])).toBeLessThan(1e-8);
        }
    });

    it("keeps the copied coordinate unchanged when scale and shift are zero", () => {
        const input: Input = { x: [5, -3], layers: [{ scale: 0.9, shift: 2, flip: false }] };
        const frames = [...mod.run(input)];
        const out = frames[frames.length - 1]?.meta?.["vector"] as number[];
        expect(out[0]).toBeCloseTo(5, 9);
        expect(out[1]).not.toBeCloseTo(-3, 2);
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
