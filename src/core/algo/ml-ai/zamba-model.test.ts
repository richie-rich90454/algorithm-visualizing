/**
 * zamba-model.test.ts - Independent Zamba recomputation, shared-kernel
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { sharedKernel, zamba } from "./zamba-model";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function reference(tokens: number[], layers: number, every: number, decay: number, write: number) {
    const raw = Array.from({ length: tokens.length }, (_, d) => 1 / (d + 1));
    const total = raw.reduce((a, b) => a + b, 0);
    const kernel = raw.map((v) => v / total);
    let x = tokens.slice();
    const perLayer = [x.slice()];
    for (let l = 0; l < layers; l += 1) {
        const out: number[] = [];
        if ((l + 1) % every === 0) {
            for (let i = 0; i < x.length; i += 1) {
                let sum = 0;
                for (let j = 0; j <= i; j += 1) sum += kernel[i - j] * x[j];
                out.push(sum);
            }
        } else {
            let state = 0;
            for (const v of x) {
                state = decay * state + write * v;
                out.push(state);
            }
        }
        x = out;
        perLayer.push(x.slice());
    }
    return { perLayer, output: x, kernel };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("Zamba hybrid model", () => {
    it("matches an independent hybrid recomputation", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const tokens = Array.from({ length: 5 }, (_, i) => ((i * 4 + seed * 2) % 9) / 2 - 2);
            const params = { layers: 1 + (seed % 6), sharedEvery: 1 + (seed % 3), decay: 0.3 + seed / 20, write: 0.8 + seed / 30 };
            const got = zamba(tokens, params);
            const ref = reference(tokens, params.layers, params.sharedEvery, params.decay, params.write);
            expect(got.kernel).toEqual(ref.kernel);
            expect(got.perLayer).toEqual(ref.perLayer);
            expect(got.output).toEqual(ref.output);
        }
    });

    it("builds a normalized causal kernel and preserves length", () => {
        const kernel = sharedKernel(6);
        expect(kernel.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        for (let i = 1; i < kernel.length; i += 1) expect(kernel[i]).toBeLessThanOrEqual(kernel[i - 1]);
        expect(zamba([1, 2, 3], { layers: 7, sharedEvery: 2 }).output.length).toBe(3);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const input = mod.defaultInput as { layers: number };
        expect(frames.length).toBe(2 + input.layers);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
