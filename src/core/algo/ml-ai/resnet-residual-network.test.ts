/**
 * resnet-residual-network.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./resnet-residual-network";
import type { VisualFrame } from "@/types";

type Vector = number[];
type Matrix = number[][];

interface BlockInput {
    x: Vector;
    w1: Matrix;
    b1: Vector;
    w2: Matrix;
    b2: Vector;
}

function matVec(w: Matrix, x: Vector): Vector {
    return w.map((row) => row.reduce((sum, weight, index) => sum + weight * (x[index] ?? 0), 0));
}

function relu(v: Vector): Vector {
    return v.map((value) => Math.max(0, value));
}

/** Independent reference forward pass of the residual block. */
function reference(cfg: BlockInput): Vector {
    const a = matVec(cfg.w1, cfg.x).map((value, i) => value + (cfg.b1[i] ?? 0));
    const b = matVec(cfg.w2, relu(a)).map((value, i) => value + (cfg.b2[i] ?? 0));
    return relu(b.map((value, i) => value + (cfg.x[i] ?? 0)));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Residual network block", () => {
    it("matches an independent forward-pass reference", () => {
        const cfg: BlockInput = {
            x: [1, -0.5],
            w1: [[0.5, -0.3], [0.2, 0.8]],
            b1: [0.1, -0.1],
            w2: [[-0.4, 0.6], [0.3, -0.2]],
            b2: [0.05, 0.05],
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const finalValues = frames[frames.length - 1]?.meta["values"] as number[];
        expect(finalValues.length).toBe(expected.length);
        expected.forEach((value, i) => expect(finalValues[i]).toBeCloseTo(value, 6));
    });

    it("produces the same result on a second input and preserves dimension", () => {
        const cfg: BlockInput = {
            x: [-2, 1.5],
            w1: [[0.1, 0.4], [-0.3, 0.2]],
            b1: [0.2, -0.1],
            w2: [[0.5, -0.6], [0.1, 0.3]],
            b2: [-0.2, 0.4],
        };
        const frames = [...mod.run(cfg)];
        const expected = reference(cfg);
        const finalValues = frames[frames.length - 1]?.meta["values"] as number[];
        expected.forEach((value, i) => expect(finalValues[i]).toBeCloseTo(value, 6));
        expect(finalValues.length).toBe(cfg.x.length);
    });

    it("the skip connection actually changes the output", () => {
        const cfg: BlockInput = {
            x: [1, -0.5],
            w1: [[0.5, -0.3], [0.2, 0.8]],
            b1: [0.1, -0.1],
            w2: [[-0.4, 0.6], [0.3, -0.2]],
            b2: [0.05, 0.05],
        };
        const withSkip = reference(cfg);
        const b = matVec(cfg.w2, relu(matVec(cfg.w1, cfg.x).map((v, i) => v + cfg.b1[i]))).map((v, i) => v + cfg.b2[i]);
        const withoutSkip = relu(b);
        expect(withSkip.some((value, i) => Math.abs(value - withoutSkip[i]) > 1e-6)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
