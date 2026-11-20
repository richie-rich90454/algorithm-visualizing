/** byol.test.ts - Stop-gradient gradients and EMA target, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./byol";
import type { VisualFrame } from "@/types";

interface Input {
    view1: number[];
    view2: number[];
    online: number[];
    predictor: number[];
    target: number[];
    learningRate: number;
    decay: number;
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
    const online = [...input.online];
    const predictor = [...input.predictor];
    const target = [...input.target];
    const y1 = online.map((v, i) => v * input.view1[i]!);
    const y2 = online.map((v, i) => v * input.view2[i]!);
    const p1 = predictor.map((v, i) => v * y1[i]!);
    const p2 = predictor.map((v, i) => v * y2[i]!);
    const t2 = target.map((v, i) => v * input.view2[i]!);
    const t1 = target.map((v, i) => v * input.view1[i]!);
    const gp = predictor.map((_v, i) =>
        (p1[i]! - t2[i]!) * y1[i]! + (p2[i]! - t1[i]!) * y2[i]!,
    );
    const go = online.map((_v, i) =>
        (p1[i]! - t2[i]!) * predictor[i]! * input.view1[i]! +
        (p2[i]! - t1[i]!) * predictor[i]! * input.view2[i]!,
    );
    predictor.forEach((v, i) => {
        predictor[i] = v - input.learningRate * gp[i]!;
    });
    online.forEach((v, i) => {
        online[i] = v - input.learningRate * go[i]!;
    });
    const loss =
        0.5 *
        (p1.reduce((s, v, i) => s + (v - t2[i]!) ** 2, 0) +
            p2.reduce((s, v, i) => s + (v - t1[i]!) ** 2, 0));
    const newTarget = target.map((v, i) => input.decay * v + (1 - input.decay) * online[i]!);
    return { online, predictor, target: newTarget, loss };
}

describe("Bootstrap Your Own Latent", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent stop-gradient replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = replay(input);
        const final = frames[frames.length - 1]!.meta;
        (final["online"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.online[i]!, 10));
        (final["predictor"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.predictor[i]!, 10));
        (final["target"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.target[i]!, 10));
        expect(Number(final["loss"])).toBeCloseTo(expected.loss, 10);
    });

    it("changes the target encoder only by exponential moving average", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        const previous = final["previousTarget"] as number[];
        const online = final["online"] as number[];
        const target = final["target"] as number[];
        target.forEach((v, i) =>
            expect(v).toBeCloseTo(input.decay * previous[i]! + (1 - input.decay) * online[i]!, 10),
        );
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
