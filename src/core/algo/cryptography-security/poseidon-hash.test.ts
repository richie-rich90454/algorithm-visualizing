/** poseidon-hash.test.ts - Independent permutation replay, determinism, diffusion. */

import { describe, expect, it } from "vitest";
import mod, { buildPoseidon } from "./poseidon-hash";
import type { VisualFrame } from "@/types";

interface Input {
    input: number;
    seed: number;
    rounds: number;
}

const P = 2147483647n;
const fm = (x: bigint): bigint => ((x % P) + P) % P;
const ad = (a: bigint, b: bigint): bigint => fm(a + b);
const mu = (a: bigint, b: bigint): bigint => fm(a * b);

function pow5(base: bigint): bigint {
    let r = 1n;
    let b = fm(base);
    let e = 5n;
    while (e > 0n) {
        if (e & 1n) r = mu(r, b);
        b = mu(b, b);
        e >>= 1n;
    }
    return r;
}

/** Independent Poseidon replay used only to verify the module. */
function reference(input: number, seed: number, rounds: number): number[][] {
    let s = seed >>> 0;
    const constants: bigint[][] = [];
    for (let r = 0; r < rounds; r += 1) {
        const row: bigint[] = [];
        for (let i = 0; i < 2; i += 1) {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            row.push(BigInt(s) % P);
        }
        constants.push(row);
    }
    const mds: bigint[][] = [[2n, 1n], [1n, 3n]];
    let state: bigint[] = [fm(BigInt(input)), 0n];
    const states: number[][] = [];
    for (let r = 0; r < rounds; r += 1) {
        state = state.map((v, i) => ad(v, constants[r]?.[i] ?? 0n));
        const full = r < 1 || r >= rounds - 1;
        state = state.map((v, i) => (full || i === 0 ? pow5(v) : v));
        const next: bigint[] = [];
        for (let i = 0; i < 2; i += 1) {
            let sum = 0n;
            for (let j = 0; j < 2; j += 1) sum = ad(sum, mu(mds[i]?.[j] ?? 0n, state[j] ?? 0n));
            next.push(sum);
        }
        state = next;
        states.push(state.map((v) => Number(v)));
    }
    return states;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Poseidon Hash toy model", () => {
    it("matches an independent permutation replay at every round", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rounds);
        const data = buildPoseidon(input.input, input.seed, input.rounds);
        const expected = reference(input.input, input.seed, input.rounds);
        expected.forEach((row, r) => {
            row.forEach((value, i) => {
                expect(data.states[r]?.[i]).toBe(value);
            });
        });
        expect(data.output).toBe(expected[expected.length - 1]?.[0]);
        expect(frames[frames.length - 1]?.meta["output"]).toBe(data.output);
    });

    it("is deterministic and stays inside the field", () => {
        for (const value of [0, 1, 17, 123456, 2147483646]) {
            const a = buildPoseidon(value, 99, 6);
            const b = buildPoseidon(value, 99, 6);
            expect(a.output).toBe(b.output);
            expect(a.output).toBeGreaterThanOrEqual(0);
            expect(a.output).toBeLessThan(2147483647);
            a.states.forEach((row) => {
                row.forEach((v) => {
                    expect(v).toBeGreaterThanOrEqual(0);
                    expect(v).toBeLessThan(2147483647);
                });
            });
        }
    });

    it("changes the digest when the input changes", () => {
        const outputs = new Set<number>();
        for (let input = 0; input < 12; input += 1) {
            outputs.add(buildPoseidon(input, 20261118, 6).output);
        }
        expect(outputs.size).toBe(12);
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
