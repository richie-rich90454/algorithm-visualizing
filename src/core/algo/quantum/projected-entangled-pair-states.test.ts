/**
 * projected-entangled-pair-states.test.ts - Independent row-wise contraction,
 * product-state comparison, normalization property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./projected-entangled-pair-states";
import type { VisualFrame } from "@/types";

type Complex = [number, number];

function multiply(left: Complex, right: Complex): Complex {
    return [left[0] * right[0] - left[1] * right[1], left[0] * right[1] + left[1] * right[0]];
}

function tensor(site: number, spin: number, l: number, r: number, u: number, d: number, product: boolean): Complex {
    if (product) {
        const factor = Math.sin((site + 1) * (spin + 1) * 0.7);
        return l === 0 && r === 0 && u === 0 && d === 0 ? [factor, 0] : [0, 0];
    }
    const magnitude = (spin + 1) + 0.5 * (l + 2 * r + 3 * u + 4 * d) + site * 0.25;
    const angle = 0.3 * (l + 2 * r + 3 * u + 4 * d + spin + site);
    return [magnitude * Math.cos(angle), magnitude * Math.sin(angle)];
}

/** Contract row by row, a different order from the module's full enumeration. */
function referenceAmplitudes(product: boolean): { re: number[]; im: number[] } {
    const re = new Array<number>(16).fill(0);
    const im = new Array<number>(16).fill(0);
    for (let s00 = 0; s00 < 2; s00 += 1) {
        for (let s01 = 0; s01 < 2; s01 += 1) {
            for (let s10 = 0; s10 < 2; s10 += 1) {
                for (let s11 = 0; s11 < 2; s11 += 1) {
                    let sum: Complex = [0, 0];
                    for (let h0 = 0; h0 < 2; h0 += 1) {
                        for (let h1 = 0; h1 < 2; h1 += 1) {
                            for (let v0 = 0; v0 < 2; v0 += 1) {
                                for (let v1 = 0; v1 < 2; v1 += 1) {
                                    const top = multiply(
                                        tensor(0, s00, 0, h0, 0, v0, product),
                                        tensor(1, s01, h0, 0, 0, v1, product),
                                    );
                                    const bottom = multiply(
                                        tensor(2, s10, 0, h1, v0, 0, product),
                                        tensor(3, s11, h1, 0, v1, 0, product),
                                    );
                                    const term = multiply(top, bottom);
                                    sum = [sum[0] + term[0], sum[1] + term[1]];
                                }
                            }
                        }
                    }
                    const index = (s00 << 3) | (s01 << 2) | (s10 << 1) | s11;
                    re[index] = sum[0];
                    im[index] = sum[1];
                }
            }
        }
    }
    const norm = Math.sqrt(re.reduce((sum, value, index) => sum + value * value + (im[index] ?? 0) ** 2, 0));
    return { re: re.map((value) => value / norm), im: im.map((value) => value / norm) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("projected entangled pair states", () => {
    it("matches an independent row-wise contraction", () => {
        for (const product of [false, true]) {
            const frames = [...mod.run({ product })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = referenceAmplitudes(product);
            const actualRe = final["re"] as number[];
            const actualIm = final["im"] as number[];
            expect(actualRe.length).toBe(16);
            expect(actualIm.length).toBe(16);
            for (let i = 0; i < 16; i += 1) {
                expect(actualRe[i]).toBeCloseTo(expected.re[i]!, 9);
                expect(actualIm[i]).toBeCloseTo(expected.im[i]!, 9);
            }
        }
    });

    it("factorizes into single-site amplitudes in product mode", () => {
        const frames = [...mod.run({ product: true })];
        const final = frames[frames.length - 1]!.meta;
        const re = final["re"] as number[];
        const im = final["im"] as number[];
        const products = Array.from({ length: 16 }, (_, index) => {
            const s00 = (index >> 3) & 1;
            const s01 = (index >> 2) & 1;
            const s10 = (index >> 1) & 1;
            const s11 = index & 1;
            return Math.sin(1 * (s00 + 1) * 0.7) * Math.sin(2 * (s01 + 1) * 0.7)
                * Math.sin(3 * (s10 + 1) * 0.7) * Math.sin(4 * (s11 + 1) * 0.7);
        });
        const norm = Math.sqrt(products.reduce((sum, value) => sum + value * value, 0));
        for (let index = 0; index < 16; index += 1) {
            expect(re[index]).toBeCloseTo(products[index]! / norm, 9);
            expect(im[index]).toBeCloseTo(0, 9);
        }
    });

    it("returns a normalized probability distribution", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]!.meta;
        const probabilities = final["probabilities"] as number[];
        expect(probabilities.length).toBe(16);
        expect(probabilities.every((value) => value >= 0)).toBe(true);
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
