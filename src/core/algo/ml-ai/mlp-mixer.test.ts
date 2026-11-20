/** mlp-mixer.test.ts - Independent layer reference, weight-sharing property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./mlp-mixer";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface MLP {
    w1: Matrix;
    b1: number[];
    w2: Matrix;
    b2: number[];
}
interface Input {
    x: Matrix;
    token: MLP;
    channel: MLP;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

const TOKEN: MLP = {
    w1: [
        [1, 0.5],
        [-0.5, 1],
        [0.2, 0.2],
    ],
    b1: [0, 0.1, -0.1],
    w2: [
        [0.5, -0.2, 0.1],
        [0.3, 0.4, -0.1],
    ],
    b2: [0, 0],
};

const CHANNEL: MLP = {
    w1: [
        [1, -0.5],
        [0.5, 1],
        [0.2, 0.3],
    ],
    b1: [0, 0, 0.1],
    w2: [
        [0.4, 0.2, -0.1],
        [-0.2, 0.5, 0.3],
    ],
    b2: [0, 0],
};

function gelu(v: number): number {
    return 0.5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v * v * v)));
}

function mlp(vector: number[], net: MLP): number[] {
    const hidden = net.w1.map((row, i) => row.reduce((s, v, j) => s + v * (vector[j] ?? 0), net.b1[i] ?? 0));
    const activated = hidden.map(gelu);
    return net.w2.map((row, i) => row.reduce((s, v, j) => s + v * (activated[j] ?? 0), net.b2[i] ?? 0));
}

/** Independent reference for the whole mixer block written out with explicit loops. */
function reference(input: Input) {
    const X = input.x;
    const S = X.length;
    const C = X[0]?.length ?? 0;
    const tokenMixed: Matrix = X.map((row) => row.slice());
    for (let c = 0; c < C; c += 1) {
        const column = X.map((row) => row[c] ?? 0);
        const mixed = mlp(column, input.token);
        for (let t = 0; t < S; t += 1) tokenMixed[t]![c] = (X[t]?.[c] ?? 0) + (mixed[t] ?? 0);
    }
    const output: Matrix = tokenMixed.map((row) => row.slice());
    for (let t = 0; t < S; t += 1) {
        const mixed = mlp(tokenMixed[t] ?? [], input.channel);
        for (let c = 0; c < C; c += 1) output[t]![c] = (tokenMixed[t]?.[c] ?? 0) + (mixed[c] ?? 0);
    }
    return { tokenMixed, output };
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

describe("MLP-Mixer", () => {
    it("matches an independent reference for both stages", () => {
        const input: Input = { ...(mod.defaultInput as { x: Matrix }), token: TOKEN, channel: CHANNEL };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const actualTokens = frames[1]?.meta["tokenMixed"] as Matrix;
        const actualOutput = frames[frames.length - 1]?.meta["output"] as Matrix;
        actualTokens.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.tokenMixed[i]![j]!)).toBe(true)));
        actualOutput.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.output[i]![j]!)).toBe(true)));
    });

    it("keeps token mixing independent across channels", () => {
        const input: Input = { ...(mod.defaultInput as { x: Matrix }), token: TOKEN, channel: CHANNEL };
        const changed: Input = {
            ...input,
            x: [
                [9, input.x[0]![1]!],
                [-4, input.x[1]![1]!],
            ],
        };
        const original = [...mod.run(input)][1]?.meta["tokenMixed"] as Matrix;
        const modified = [...mod.run(changed)][1]?.meta["tokenMixed"] as Matrix;
        for (let t = 0; t < original.length; t += 1) {
            expect(close(modified[t]![1]!, original[t]![1]!)).toBe(true);
            expect(close(modified[t]![0]!, original[t]![0]!)).toBe(false);
        }
    });

    it("matches the reference on a larger table", () => {
        const input: Input = {
            x: [
                [0.5, 1, -0.2],
                [2, 0, 0.4],
                [-1, 0.7, 3],
            ],
            token: {
                w1: [
                    [1, 0, -0.5],
                    [0.2, 1, 0.3],
                ],
                b1: [0, 0.1],
                w2: [
                    [0.5, 0.2],
                    [-0.1, 0.4],
                    [0.3, -0.2],
                ],
                b2: [0, 0, 0],
            },
            channel: {
                w1: [
                    [1, 0.2, 0],
                    [0, 1, -0.3],
                ],
                b1: [0, 0],
                w2: [
                    [0.3, 0],
                    [0, 0.5],
                    [0.2, 0.1],
                ],
                b2: [0, 0, 0],
            },
        };
        const expected = reference(input);
        const frames = [...mod.run(input)];
        const actual = frames[frames.length - 1]?.meta["output"] as Matrix;
        actual.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.output[i]![j]!)).toBe(true)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(3);
        expect(generator.next().done).toBe(true);
    });
});
