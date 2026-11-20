/** capsule-network.test.ts - Independent routing reference, coupling and squash properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./capsule-network";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    lower: Matrix;
    weights: Matrix[][];
    routings: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function squash(v: number[]): number[] {
    const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (len < 1e-12) return v.map(() => 0);
    const scale = (len * len) / (1 + len * len) / len;
    return v.map((x) => x * scale);
}

function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exp = values.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / total);
}

/** Independent reference for dynamic routing, written out with explicit loops. */
function reference(input: Input) {
    const L = input.lower.length;
    const H = input.weights[0]?.length ?? 0;
    const d = input.lower[0]?.length ?? 0;
    const votes: number[][][] = [];
    for (let i = 0; i < L; i += 1) {
        const row: number[][] = [];
        for (let j = 0; j < H; j += 1) row.push((input.weights[i]?.[j] ?? []).map((r) => dot(r, input.lower[i] ?? [])));
        votes.push(row);
    }
    const outputs: Matrix = [];
    const couplings: Matrix = [];
    for (let j = 0; j < H; j += 1) {
        const logits = new Array<number>(L).fill(0);
        let coupling = new Array<number>(L).fill(1 / L);
        let output = new Array<number>(d).fill(0);
        for (let iter = 0; iter < input.routings; iter += 1) {
            coupling = softmax(logits);
            output = new Array<number>(d).fill(0);
            for (let i = 0; i < L; i += 1) {
                for (let k = 0; k < d; k += 1) output[k] = (output[k] ?? 0) + (coupling[i] ?? 0) * (votes[i]![j]![k] ?? 0);
            }
            output = squash(output);
            for (let i = 0; i < L; i += 1) logits[i] = (logits[i] ?? 0) + dot(votes[i]![j]!, output);
        }
        couplings.push(coupling);
        outputs.push(output);
    }
    return { couplings, outputs };
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

describe("Capsule network routing", () => {
    it("matches an independent routing reference on the default input", () => {
        const input = mod.defaultInput as Input;
        const weights: Matrix[][] = [
            [
                [
                    [1, 0],
                    [0, 1],
                ],
                [
                    [0.5, 0],
                    [0, 0.5],
                ],
            ],
            [
                [
                    [0, 0.5],
                    [0.5, 0],
                ],
                [
                    [1, 0],
                    [0, 1],
                ],
            ],
        ];
        const full = { ...input, weights };
        const frames = [...mod.run(full)];
        checkFrames(frames);
        const expected = reference(full);
        const outputs = frames[frames.length - 1]?.meta["outputs"] as Matrix;
        const couplings = frames[frames.length - 1]?.meta["couplings"] as Matrix;
        outputs.forEach((row, i) => row.forEach((v, k) => expect(close(v, expected.outputs[i]![k]!)).toBe(true)));
        couplings.forEach((row, i) => row.forEach((v, k) => expect(close(v, expected.couplings[i]![k]!)).toBe(true)));
    });

    it("keeps couplings normalized and squashed outputs shorter than one", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const couplings = frames[frames.length - 1]?.meta["couplings"] as Matrix;
        couplings.forEach((row) => expect(close(row.reduce((a, b) => a + b, 0), 1)).toBe(true));
        const outputs = frames[frames.length - 1]?.meta["outputs"] as Matrix;
        outputs.forEach((row) => {
            const len = Math.sqrt(row.reduce((s, v) => s + v * v, 0));
            expect(len).toBeLessThan(1);
            expect(Number.isFinite(len)).toBe(true);
        });
    });

    it("matches the reference with three lower capsules and more rounds", () => {
        const input: Input = {
            lower: [
                [1, 0],
                [0.6, 0.8],
                [-0.3, 0.5],
            ],
            routings: 5,
            weights: [
                [
                    [
                        [1, 0],
                        [0, 1],
                    ],
                    [
                        [0.5, 0.2],
                        [0, 0.8],
                    ],
                ],
                [
                    [
                        [0.8, 0],
                        [0.1, 1],
                    ],
                    [
                        [1, 0],
                        [0, 1],
                    ],
                ],
                [
                    [
                        [0, 1],
                        [1, 0],
                    ],
                    [
                        [0.7, 0],
                        [0, 0.7],
                    ],
                ],
            ],
        };
        const expected = reference(input);
        const frames = [...mod.run(input)];
        const outputs = frames[frames.length - 1]?.meta["outputs"] as Matrix;
        outputs.forEach((row, i) => row.forEach((v, k) => expect(close(v, expected.outputs[i]![k]!)).toBe(true)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
