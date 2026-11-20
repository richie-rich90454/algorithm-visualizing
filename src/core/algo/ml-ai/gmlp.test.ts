/** gmlp.test.ts - Independent spatial gating reference, cross-token property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./gmlp";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    x: Matrix;
    spatialWeights: Matrix;
    gamma?: number[];
    beta?: number[];
    eps?: number;
}

function close(a: number, b: number, eps = 1e-8): boolean {
    return Math.abs(a - b) <= eps;
}

/** Independent reference written from the layer definition. */
function reference(input: Input) {
    const S = input.x.length;
    const d = input.x[0]?.length ?? 0;
    const h = Math.floor(d / 2);
    const gamma = input.gamma ?? new Array(h).fill(1);
    const beta = input.beta ?? new Array(h).fill(0);
    const eps = input.eps ?? 1e-5;
    const norm: Matrix = [];
    for (let t = 0; t < S; t += 1) {
        const row = (input.x[t] ?? []).slice(h);
        const mean = row.reduce((a, b) => a + b, 0) / row.length;
        const variance = row.reduce((s, v) => s + (v - mean) ** 2, 0) / row.length;
        const inv = 1 / Math.sqrt(variance + eps);
        norm.push(row.map((v, c) => (v - mean) * inv * (gamma[c] ?? 1) + (beta[c] ?? 0)));
    }
    const gate: Matrix = [];
    for (let t = 0; t < S; t += 1) {
        const row: number[] = [];
        for (let c = 0; c < h; c += 1) {
            let sum = 0;
            for (let s = 0; s < S; s += 1) sum += (input.spatialWeights[t]?.[s] ?? 0) * (norm[s]?.[c] ?? 0);
            row.push(sum);
        }
        gate.push(row);
    }
    const output: Matrix = input.x.map((row, t) => row.slice(0, h).map((v, c) => v * (gate[t]?.[c] ?? 0)));
    return { norm, gate, output };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("gMLP spatial gating", () => {
    it("matches an independent reference on the default input", () => {
        const input: Input = {
            ...(mod.defaultInput as { x: Matrix }),
            spatialWeights: [
                [1, 0.5],
                [0.5, 1],
            ],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const norm = frames[1]?.meta["normV"] as Matrix;
        const gate = frames[2]?.meta["gate"] as Matrix;
        const output = frames[frames.length - 1]?.meta["output"] as Matrix;
        norm.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.norm[i]![j]!)).toBe(true)));
        gate.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.gate[i]![j]!)).toBe(true)));
        output.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.output[i]![j]!)).toBe(true)));
    });

    it("produces a spatially mixed gate with nonzero off-token weights", () => {
        const input: Input = {
            ...(mod.defaultInput as { x: Matrix }),
            spatialWeights: [
                [1, 0.5],
                [0.5, 1],
            ],
        };
        const frames = [...mod.run(input)];
        const gate = frames[2]?.meta["gate"] as Matrix;
        expect(Number.isFinite(gate[0]![0]!)).toBe(true);
        const changed: Input = {
            ...input,
            x: [
                [1, 2, 9, -7],
                [0, -1, 2, 1],
            ],
        };
        const changedGate = [...mod.run(changed)][2]?.meta["gate"] as Matrix;
        expect(close(changedGate[1]![0]!, gate[1]![0]!)).toBe(false);
    });

    it("matches the reference with gain, bias and a second token count", () => {
        const input: Input = {
            x: [
                [1, 0.5, 2, -1, 0.3, 4],
                [-2, 1, 0, 2, 1, -3],
                [0.5, 0.5, -1, 0.2, 3, 1],
            ],
            spatialWeights: [
                [1, 0.2, 0],
                [0, 1, 0.4],
                [0.3, 0, 1],
            ],
            gamma: [1, 0.5, 2],
            beta: [0.1, 0, -0.1],
            eps: 1e-4,
        };
        const expected = reference(input);
        const frames = [...mod.run(input)];
        const output = frames[frames.length - 1]?.meta["output"] as Matrix;
        output.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.output[i]![j]!)).toBe(true)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
