/** pix2pix.test.ts - Conditional GAN loss terms and their properties. */
import { describe, expect, it } from "vitest";
import mod from "./pix2pix";
import type { VisualFrame } from "@/types";

interface Input {
    inputA: number[];
    targetB: number[];
    generatorWeights: number[][];
    generatorBias: number[];
    discriminatorWeights: number[];
    discriminatorBias: number;
    lambdaL1: number;
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

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}
function reference(input: Input) {
    const d = input.generatorWeights.length;
    const gen = input.generatorWeights.map((row, j) =>
        (input.generatorBias[j] ?? 0) + row.reduce((s, w, i) => s + w * input.inputA[i]!, 0),
    );
    const err = gen.map((g, j) => Math.abs(g - input.targetB[j]!));
    const l1 = err.reduce((a, b) => a + b, 0) / d;
    const scores = gen.map((g) => sigmoid((input.discriminatorWeights[0] ?? 0) * g + input.discriminatorBias));
    const adv = -scores.reduce((s, v) => s + Math.log(v + 1e-12), 0) / d;
    return { gen, err, scores, l1, adv, total: adv + input.lambdaL1 * l1 };
}

describe("Pix2Pix conditional GAN", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent reconstruction and adversarial reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const ref = reference(input);
        (final["generated"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.gen[i]!, 10));
        (final["absErrors"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.err[i]!, 10));
        (final["scores"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.scores[i]!, 10));
        expect(final["l1Loss"] as number).toBeCloseTo(ref.l1, 10);
        expect(final["advLoss"] as number).toBeCloseTo(ref.adv, 10);
        expect(final["totalLoss"] as number).toBeCloseTo(ref.total, 10);
    });

    it("gives zero reconstruction loss when the generator matches the target", () => {
        const exact: Input = {
            ...input,
            generatorWeights: input.targetB.map((target, j) =>
                Array.from({ length: input.inputA.length }, (_, i) => (i === 0 ? target / input.inputA[0]! : 0)),
            ),
            generatorBias: input.targetB.map(() => 0),
        };
        const final = [...mod.run(exact)].at(-1)!.meta;
        expect(final["l1Loss"] as number).toBeCloseTo(0, 10);
        expect(final["totalLoss"] as number).toBeCloseTo(final["advLoss"] as number, 10);
    });

    it("lowers adversarial loss when the discriminator believes the output more", () => {
        const low = [...mod.run({ ...input, discriminatorBias: -5 })].at(-1)!.meta;
        const high = [...mod.run({ ...input, discriminatorBias: 5 })].at(-1)!.meta;
        expect(high["advLoss"] as number).toBeLessThan(low["advLoss"] as number);
        expect((high["l1Loss"] as number)).toBeCloseTo(low["l1Loss"] as number, 10);
    });

    it("scales only the reconstruction term with lambda", () => {
        for (const lambda of [1, 5, 20]) {
            const final = [...mod.run({ ...input, lambdaL1: lambda })].at(-1)!.meta;
            expect(final["totalLoss"] as number).toBeCloseTo(
                (final["advLoss"] as number) + lambda * (final["l1Loss"] as number),
                10,
            );
        }
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
