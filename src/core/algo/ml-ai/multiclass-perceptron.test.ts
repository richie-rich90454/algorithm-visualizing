/**
 * multiclass-perceptron.test.ts - Independent reference, classification, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./multiclass-perceptron";
import type { VisualFrame } from "@/types";

type Point = [number, number];
interface Input {
    points: Point[];
    labels: number[];
    classes: number;
    epochs: number;
}

/** Independent multiclass perceptron used as the correctness oracle. */
function reference(input: Input) {
    const dim = input.points[0]?.length ?? 2;
    const w = Array.from({ length: input.classes }, () => new Array<number>(dim).fill(0));
    const b = new Array<number>(input.classes).fill(0);
    let mistakes = 0;
    let converged = false;
    for (let epoch = 0; epoch < input.epochs && !converged; epoch += 1) {
        converged = true;
        for (let i = 0; i < input.points.length; i += 1) {
            const p = input.points[i]!;
            const truth = input.labels[i]!;
            let best = 0;
            let top = -Infinity;
            for (let c = 0; c < input.classes; c += 1) {
                let s = b[c] ?? 0;
                for (let d = 0; d < dim; d += 1) {
                    s += (w[c]?.[d] ?? 0) * (p[d] ?? 0);
                }
                if (s > top) {
                    top = s;
                    best = c;
                }
            }
            if (best !== truth) {
                converged = false;
                mistakes += 1;
                for (let d = 0; d < dim; d += 1) {
                    w[truth]![d] = (w[truth]![d] ?? 0) + (p[d] ?? 0);
                    w[best]![d] = (w[best]![d] ?? 0) - (p[d] ?? 0);
                }
                b[truth] = (b[truth] ?? 0) + 1;
                b[best] = (b[best] ?? 0) - 1;
            }
        }
    }
    return { w, b, mistakes, converged };
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("MulticlassPerceptron", () => {
    it("matches the independent reference weight for weight", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const expected = reference(input);
        const finalMeta = frames[frames.length - 1]?.meta ?? {};
        expect(finalMeta["mistakes"]).toBe(expected.mistakes);
        expect(finalMeta["converged"]).toBe(expected.converged);
        expect(finalMeta["weights"]).toEqual(expected.w.flat());
        expect(finalMeta["biases"]).toEqual(expected.b);
    });

    it("classifies every training point correctly after convergence", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]?.meta ?? {};
        expect(meta["converged"]).toBe(true);
        const w = meta["weights"] as number[];
        const b = meta["biases"] as number[];
        const dim = input.points[0]?.length ?? 2;
        for (let i = 0; i < input.points.length; i += 1) {
            const p = input.points[i]!;
            let best = 0;
            let top = -Infinity;
            for (let c = 0; c < input.classes; c += 1) {
                let s = b[c] ?? 0;
                for (let d = 0; d < dim; d += 1) {
                    s += (w[c * dim + d] ?? 0) * (p[d] ?? 0);
                }
                if (s > top) {
                    top = s;
                    best = c;
                }
            }
            expect(best).toBe(input.labels[i]);
        }
    });

    it("does not converge on overlapping classes within a short budget", () => {
        const input: Input = {
            points: [
                [0, 0],
                [0, 0],
                [1, 1],
                [1, 1],
            ],
            labels: [0, 1, 0, 1],
            classes: 2,
            epochs: 5,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(false);
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
