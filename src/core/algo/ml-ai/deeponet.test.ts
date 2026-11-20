/** deeponet.test.ts - Brute-force dot-product reference, linearity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { deepONet, deepONetBatch } from "./deeponet";
import type { VisualFrame } from "@/types";

interface Input {
    branch: number[];
    trunks: number[][];
    bias: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DeepONet", () => {
    it("single-query output matches a brute-force dot product plus bias", () => {
        const cases: Array<[number[], number[], number]> = [
            [[1, -0.5, 2, 0.3], [0.5, 1, -0.5, 2], 0.1],
            [[2, 3], [4, 5], -1],
            [[1, 1, 1], [1, 1, 1], 0],
        ];
        for (const [branch, trunk, bias] of cases) {
            let expected = bias;
            for (let i = 0; i < branch.length; i += 1) expected += branch[i]! * trunk[i]!;
            expect(close(deepONet(branch, trunk, bias), expected)).toBe(true);
        }
    });

    it("batch evaluation is linear in the branch vector for a fixed trunk", () => {
        const trunks = [[1, 2], [3, 4]];
        const b1 = [1, 1];
        const b2 = [2, 2];
        const bias = 0;
        const out1 = deepONetBatch(b1, trunks, bias);
        const out2 = deepONetBatch(b2, trunks, bias);
        out2.forEach((v, i) => expect(close(v, 2 * out1[i]!)).toBe(true));
    });

    it("bias shifts every query and mismatched widths are handled safely", () => {
        const trunks = [[1, 0], [0, 1]];
        expect(close(deepONetBatch([2, 3], trunks, 5)[0]!, 7)).toBe(true);
        expect(close(deepONetBatch([2, 3], trunks, 5)[1]!, 8)).toBe(true);
        expect(deepONet([1, 2], [3], 0)).toBe(3);
        expect(deepONetBatch([1], [], 2)).toEqual([]);
    });

    it("matches the batch outputs through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = deepONetBatch(input.branch, input.trunks, input.bias);
        const final = frames[frames.length - 1]?.meta;
        const outputs = final?.["outputs"] as number[];
        outputs.forEach((v, i) => expect(close(v, expected[i]!)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
