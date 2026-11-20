/** stylegan.test.ts - Brute-force mapping, mixing boundary, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./stylegan";
import type { VisualFrame } from "@/types";

interface Input {
    z1: number[];
    z2: number[];
    map: number[];
    bias: number[];
    layers: number;
    crossover: number;
}

function encode(z: number[], input: Input): number[] {
    return [
        input.map[0]! * z[0]! + input.map[1]! * z[1]! + input.bias[0]!,
        input.map[2]! * z[0]! + input.map[3]! * z[1]! + input.bias[1]!,
    ];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("StyleGAN style mixing", () => {
    const cases: Input[] = [
        { z1: [1, -1], z2: [-0.5, 2], map: [0.8, 0.2, -0.3, 0.9], bias: [0.1, -0.1], layers: 6, crossover: 3 },
        { z1: [0, 0], z2: [1, 1], map: [1, 0, 0, 1], bias: [0, 0], layers: 4, crossover: 0 },
        { z1: [2, -3], z2: [-1, 0.5], map: [0.5, -0.2, 0.4, 0.7], bias: [0.3, -0.3], layers: 5, crossover: 5 },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force mapping and per-layer mixing", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expectedW1 = encode(input.z1, input);
            const expectedW2 = encode(input.z2, input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["w1"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expectedW1[i]!, 9));
            (final?.["w2"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expectedW2[i]!, 9));
            const mixed = final?.["mixed"] as number[];
            expect(mixed.length).toBe(2 * input.layers);
            for (let layer = 0; layer < input.layers; layer += 1) {
                const chosen = layer < input.crossover ? expectedW1 : expectedW2;
                expect(mixed[2 * layer]).toBeCloseTo(chosen[0]!, 9);
                expect(mixed[2 * layer + 1]).toBeCloseTo(chosen[1]!, 9);
            }
            expect(frames[4]?.entities.length).toBe(input.layers);
        }
    });

    it("crossover at zero uses only the second style", () => {
        const input = cases[1]!;
        const final = [...mod.run(input)].at(-1)?.meta;
        const mixed = final?.["mixed"] as number[];
        const w2 = final?.["w2"] as number[];
        for (let layer = 0; layer < input.layers; layer += 1) {
            expect(mixed[2 * layer]).toBeCloseTo(w2[0]!, 9);
            expect(mixed[2 * layer + 1]).toBeCloseTo(w2[1]!, 9);
        }
    });

    it("crossover at the layer count uses only the first style", () => {
        const input = cases[2]!;
        const final = [...mod.run(input)].at(-1)?.meta;
        const mixed = final?.["mixed"] as number[];
        const w1 = final?.["w1"] as number[];
        for (let layer = 0; layer < input.layers; layer += 1) {
            expect(mixed[2 * layer]).toBeCloseTo(w1[0]!, 9);
            expect(mixed[2 * layer + 1]).toBeCloseTo(w1[1]!, 9);
        }
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
