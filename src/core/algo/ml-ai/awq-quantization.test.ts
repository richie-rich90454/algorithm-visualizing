/**
 * awq-quantization.test.ts - Independent group-quantization replay, rounding
 * error bound, activation-weighted error comparison, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./awq-quantization";
import type { VisualFrame } from "@/types";

function quantize(values: number[], groupSize: number, bits: number) {
    const qmax = Math.pow(2, bits - 1) - 1;
    const qmin = -Math.pow(2, bits - 1);
    const recon = new Array<number>(values.length).fill(0);
    const codes = new Array<number>(values.length).fill(0);
    const scales: number[] = [];
    for (let start = 0; start < values.length; start += groupSize) {
        const end = Math.min(start + groupSize, values.length);
        let maxAbs = 0;
        for (let i = start; i < end; i += 1) {
            maxAbs = Math.max(maxAbs, Math.abs(values[i] ?? 0));
        }
        const scale = maxAbs / qmax;
        scales.push(scale);
        for (let i = start; i < end; i += 1) {
            const q = Math.max(qmin, Math.min(qmax, Math.round((values[i] ?? 0) / (scale || 1))));
            codes[i] = q;
            recon[i] = q * scale;
        }
    }
    return { recon, codes, scales };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["weights"]).toBeDefined();
    });
}

describe("AWQQuantization", () => {
    it("reproduces vanilla and activation-aware reconstructions exactly", () => {
        const input = mod.defaultInput as { weights: number[]; activations: number[]; groupSize: number; bits: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.weights.length);
        const final = frames[frames.length - 1]?.meta;
        const meanActivation = input.activations.reduce((a, b) => a + b, 0) / input.weights.length;
        const factors = input.activations.map((a) => Math.max(1, Math.min(2, Math.sqrt((a / meanActivation) || 1))));
        const plain = quantize(input.weights, input.groupSize, input.bits);
        const scaled = input.weights.map((w, i) => w * (factors[i] ?? 1));
        const awqScaled = quantize(scaled, input.groupSize, input.bits);
        const awq = awqScaled.recon.map((v, i) => v / (factors[i] ?? 1));

        const actualFactors = final?.["factors"] as number[];
        factors.forEach((factor, i) => {
            expect(Math.abs((actualFactors[i] ?? 0) - factor)).toBeLessThan(1e-6);
        });
        expect(final?.["vanillaCodes"]).toEqual(plain.codes);
        expect(final?.["awqCodes"]).toEqual(awqScaled.codes);
        const actualVanilla = final?.["vanillaRecon"] as number[];
        const actualAwq = final?.["awqRecon"] as number[];
        for (let i = 0; i < input.weights.length; i += 1) {
            expect(Math.abs((actualVanilla[i] ?? 0) - (plain.recon[i] ?? 0))).toBeLessThan(1e-6);
            expect(Math.abs((actualAwq[i] ?? 0) - (awq[i] ?? 0))).toBeLessThan(1e-6);
        }
    });

    it("keeps each reconstruction within half a quantization step", () => {
        const input = mod.defaultInput as { weights: number[]; groupSize: number; bits: number };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const recon = final?.["vanillaRecon"] as number[];
        const qmax = Math.pow(2, input.bits - 1) - 1;
        for (let start = 0; start < input.weights.length; start += input.groupSize) {
            const group = input.weights.slice(start, start + input.groupSize);
            const step = Math.max(...group.map(Math.abs)) / qmax;
            for (let i = start; i < start + group.length; i += 1) {
                expect(Math.abs((input.weights[i] ?? 0) - (recon[i] ?? 0))).toBeLessThanOrEqual(step / 2 + 1e-9);
            }
        }
    });

    it("reduces activation-weighted error on the default salient-channel case", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["vanillaError"]).toBeGreaterThan(0);
        expect(final?.["awqError"]).toBeLessThan(final?.["vanillaError"] as number);
        expect(final?.["improved"]).toBe(true);
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
