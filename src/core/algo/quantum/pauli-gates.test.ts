/**
 * pauli-gates.test.ts - Independent complex-matrix reference, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pauli-gates";
import type { VisualFrame } from "@/types";

type Gate = "X" | "Y" | "Z";
type C = [number, number];

const S = Math.SQRT1_2;

function initial(name: string): [C, C] {
    if (name === "1") return [[0, 0], [1, 0]];
    if (name === "+") return [[S, 0], [S, 0]];
    if (name === "-") return [[S, 0], [-S, 0]];
    return [[1, 0], [0, 0]];
}

/** Reference: full two-by-two complex matrix-vector multiplication. */
function reference(state: [C, C], gate: Gate): [C, C] {
    const matrix: C[][] = gate === "X"
        ? [[[0, 0], [1, 0]], [[1, 0], [0, 0]]]
        : gate === "Z"
            ? [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]]
            : [[[0, 0], [0, -1]], [[0, 1], [0, 0]]];
    const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
    return [
        add(mul(matrix[0]![0]!, state[0]), mul(matrix[0]![1]!, state[1])),
        add(mul(matrix[1]![0]!, state[0]), mul(matrix[1]![1]!, state[1])),
    ];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Pauli Gates", () => {
    it("matches independent matrix multiplication on all states and gate sequences", () => {
        const states = ["0", "1", "+", "-"];
        const sequence: Gate[] = ["X", "Y", "Z", "X", "Y", "Z"];
        for (const s of states) {
            const frames = [...mod.run({ state: s, gates: sequence })];
            checkFrames(frames);
            let ref = initial(s);
            for (let i = 0; i < sequence.length; i += 1) {
                ref = reference(ref, sequence[i]!);
                const meta = frames[i + 1]!.meta;
                const re = meta["reals"] as number[];
                const im = meta["imags"] as number[];
                expect(re[0]).toBeCloseTo(ref[0][0], 10);
                expect(im[0]).toBeCloseTo(ref[0][1], 10);
                expect(re[1]).toBeCloseTo(ref[1][0], 10);
                expect(im[1]).toBeCloseTo(ref[1][1], 10);
            }
        }
    });

    it("satisfies the known single-gate identities", () => {
        const cases: Array<{ state: string; gate: Gate; re: number[]; im: number[] }> = [
            { state: "0", gate: "X", re: [0, 1], im: [0, 0] },
            { state: "0", gate: "Z", re: [1, 0], im: [0, 0] },
            { state: "+", gate: "Z", re: [S, -S], im: [0, 0] },
            { state: "0", gate: "Y", re: [0, 0], im: [0, 1] },
        ];
        for (const c of cases) {
            const meta = [...mod.run({ state: c.state, gates: [c.gate] })].at(-1)!.meta;
            const re = meta["reals"] as number[];
            const im = meta["imags"] as number[];
            for (let i = 0; i < 2; i += 1) {
                expect(re[i]).toBeCloseTo(c.re[i]!, 10);
                expect(im[i]).toBeCloseTo(c.im[i]!, 10);
            }
        }
    });

    it("keeps the state normalized", () => {
        const frames = [...mod.run({ state: "+", gates: ["X", "Y", "Z"] })];
        for (const frame of frames) expect(Number(frame.meta["norm"])).toBeCloseTo(1, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
