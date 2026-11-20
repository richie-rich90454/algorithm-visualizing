/** controlnet.test.ts - Additive control conditioning and zero-init identity. */
import { describe, expect, it } from "vitest";
import mod from "./controlnet";
import type { VisualFrame } from "@/types";

interface Input {
    baseOutputs: number[][];
    controlSignals: number[][];
    controlWeights: number[][];
    scale: number;
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

function reference(input: Input) {
    const d = input.baseOutputs[0]!.length;
    const controlOut = input.controlSignals.map((c) =>
        Array.from({ length: d }, (_, j) => c.reduce((sum, v, k) => sum + v * input.controlWeights[k]![j]!, 0)),
    );
    const outputs = input.baseOutputs.map((base, t) =>
        base.map((v, j) => v + input.scale * controlOut[t]![j]!),
    );
    return {
        controlOut: controlOut.reduce<number[]>((a, r) => a.concat(r), []),
        outputs: outputs.reduce<number[]>((a, r) => a.concat(r), []),
    };
}

describe("ControlNet conditioning", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent branch-and-add reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const ref = reference(input);
        (final["controlOut"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.controlOut[i]!, 10));
        (final["outputs"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(ref.outputs[i]!, 10));
    });

    it("leaves the base output unchanged for zero weights and for zero scale", () => {
        const zeroWeights: Input = { ...input, controlWeights: input.controlWeights.map((r) => r.map(() => 0)) };
        const zeroWeightFinal = [...mod.run(zeroWeights)].at(-1)!.meta;
        (zeroWeightFinal["outputs"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo((zeroWeightFinal["base"] as number[])[i]!, 10),
        );
        expect(zeroWeightFinal["zeroInitIdentity"]).toBe(true);

        const zeroScaleFinal = [...mod.run({ ...input, scale: 0 })].at(-1)!.meta;
        (zeroScaleFinal["outputs"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo((zeroScaleFinal["base"] as number[])[i]!, 10),
        );
    });

    it("makes the residual scale linearly with the conditioning strength", () => {
        const base = (input.baseOutputs[0] ?? []).slice();
        const controlOut = (reference(input).controlOut).slice(0, base.length);
        for (const scale of [1, 2, 3]) {
            const final = [...mod.run({ ...input, scale })].at(-1)!.meta;
            const outputs = final["outputs"] as number[];
            base.forEach((v, j) => expect(outputs[j]!).toBeCloseTo(v + scale * controlOut[j]!, 10));
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
