/** kronecker-substitution.test.ts - Convolution cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./kronecker-substitution";
import type { VisualFrame } from "@/types";

function bruteConvolution(a: number[], b: number[]): number[] {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) out[i + j] += a[i]! * b[j]!;
    }
    return out;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Kronecker substitution", () => {
    it("recovers the exact convolution for several polynomials", () => {
        const cases = [
            { a: [1, 2, 3], b: [4, 5] },
            { a: [7, 0, 2, 9], b: [3, 1, 4] },
            { a: [255, 255, 255], b: [255, 255] },
            { a: [1], b: [1] },
            { a: [0, 5, 0, 6], b: [2, 0, 3] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["result"]).toEqual(bruteConvolution(input.a, input.b));
            const packedA = BigInt(final["packedProduct"] as string);
            expect(packedA).toBeGreaterThan(0n);
        }
    });

    it("handles an empty polynomial without throwing", () => {
        const frames = [...mod.run({ a: [], b: [1, 2] })];
        expect(frames[0]!.meta["result"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
