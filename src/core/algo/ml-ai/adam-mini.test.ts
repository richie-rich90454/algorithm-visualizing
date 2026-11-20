/** adam-mini.test.ts - Blockwise second-moment correctness, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./adam-mini";
import type { VisualFrame } from "@/types";

interface Input {
    parameters: number[];
    gradients: number[][];
    blockSize: number;
    learningRate: number;
    beta1: number;
    beta2: number;
    epsilon: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function replay(input: Input) {
    const theta = [...input.parameters];
    const m = theta.map(() => 0);
    const blocks = Math.ceil(theta.length / input.blockSize);
    const v = new Array<number>(blocks).fill(0);
    const blockVs: number[][] = [];
    for (let t = 0; t < input.gradients.length; t += 1) {
        const g = input.gradients[t]!;
        g.forEach((grad, i) => {
            m[i] = input.beta1 * m[i]! + (1 - input.beta1) * grad;
        });
        for (let b = 0; b < blocks; b += 1) {
            let sum = 0;
            let count = 0;
            for (let i = b * input.blockSize; i < Math.min((b + 1) * input.blockSize, theta.length); i += 1) {
                sum += g[i]! * g[i]!;
                count += 1;
            }
            const meanSq = count === 0 ? 0 : sum / count;
            v[b] = input.beta2 * v[b]! + (1 - input.beta2) * meanSq;
        }
        blockVs.push([...v]);
        const c1 = 1 - Math.pow(input.beta1, t + 1);
        const c2 = 1 - Math.pow(input.beta2, t + 1);
        theta.forEach((value, i) => {
            const b = Math.floor(i / input.blockSize);
            theta[i] = value - (input.learningRate * (m[i]! / c1)) / (Math.sqrt(v[b]! / c2) + input.epsilon);
        });
    }
    return { theta, blockVs };
}

describe("Adam-mini", () => {
    const input = {
        ...(mod.defaultInput as Omit<Input, "beta1" | "beta2" | "epsilon">),
        beta1: 0.9,
        beta2: 0.999,
        epsilon: 1e-8,
    } as Input;

    it("matches an independent blockwise moment replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = replay(input);
        const final = frames[frames.length - 1]!.meta;
        (final["parameters"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.theta[i]!, 10));
        const stepFrames = frames.filter((f) => (f.meta["blockV"] as number[] | undefined)?.length);
        stepFrames.forEach((frame, t) => {
            (frame.meta["blockV"] as number[]).forEach((v, i) =>
                expect(v).toBeCloseTo(expected.blockVs[t]![i]!, 10),
            );
        });
    });

    it("uses one shared second moment for every parameter in a block", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        const blocks = Math.ceil((final["parameters"] as number[]).length / input.blockSize);
        expect(Number(final["blockCount"])).toBe(blocks);
        expect((final["parameters"] as number[]).length).toBe(input.parameters.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
