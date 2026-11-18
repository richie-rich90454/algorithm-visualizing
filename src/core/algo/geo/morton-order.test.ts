/** morton-order.test.ts - Bit interleave property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./morton-order";

type Pt = [number, number];

/** Reference interleave built one bit at a time. */
function referenceEncode(x: number, y: number): number {
    let code = 0;
    for (let bit = 0; bit < 16; bit += 1) {
        code |= ((x >>> bit) & 1) << (2 * bit);
        code |= ((y >>> bit) & 1) << (2 * bit + 1);
    }
    return code >>> 0;
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 2000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(2000);
    return frames;
}

describe("Morton Order", () => {
    it("encodes like a bit-by-bit reference and decodes back to the point", () => {
        const points: Pt[] = [
            [0, 0], [1, 1], [2, 0], [3, 2], [1, 3], [4, 4], [2, 2], [0, 3], [9, 6], [15, 7],
        ];
        const frames = framesFor({ points });
        const final = frames[frames.length - 1]!;
        const codes = final.meta.codes as number[];
        const decodedFlat = final.meta.decoded as number[];
        const decoded: Pt[] = [];
        for (let i = 0; i < decodedFlat.length; i += 2) {
            decoded.push([decodedFlat[i]!, decodedFlat[i + 1]!]);
        }

        expect(codes.map((code, i) => code)).toEqual(points.map(([x, y]) => referenceEncode(x, y)));
        expect(decoded).toEqual(points);

        const order = final.meta.order as number[];
        const referenceOrder = points
            .map((_, i) => i)
            .sort((a, b) => codes[a]! - codes[b]! || a - b);
        expect(order).toEqual(referenceOrder);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            expect(frame.entities.length).toBeGreaterThan(0);
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
