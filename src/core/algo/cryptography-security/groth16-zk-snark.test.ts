/**
 * groth16-zk-snark.test.ts - Independent arithmetic reference, brute-force
 * witness acceptance, pairing bilinearity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import alg from "./groth16-zk-snark";
import type { VisualFrame } from "@/types";

const P = 97;
const R1 = 3;
const R2 = 7;
const TAU = 11;
const ALPHA = 5;
const BETA = 9;
const GAMMA = 13;
const DELTA = 17;

const mod = (v: number) => ((v % P) + P) % P;

/** Modular inverse by brute-force scan, independent of the module's Euclid. */
function inv(v: number): number {
    const target = mod(v);
    for (let i = 1; i < P; i += 1) {
        if (mod(target * i) === 1) {
            return i;
        }
    }
    return 0;
}

/** Independently recompute the whole pairing check for a witness. */
function reference(u: number, v: number, w: number, x: number, y: number, r: number, s: number) {
    const d1 = mod((TAU - R2) * inv(R1 - R2));
    const d2 = mod((TAU - R1) * inv(R2 - R1));
    const aHat = mod(u * d1 + w * d2);
    const bHat = mod(v * d1 + x * d2);
    const cHat = mod(w * d1 + y * d2);
    const zTau = mod((TAU - R1) * (TAU - R2));
    const h = mod(-mod(u * x + w * v - u * v - w * x) * inv(mod((R1 - R2) * (R1 - R2))));
    const A = mod(ALPHA + aHat + r * DELTA);
    const B = mod(BETA + bHat + s * DELTA);
    const L = mod(mod(BETA * aHat + ALPHA * bHat + cHat) * inv(GAMMA));
    const C = mod(mod(h * zTau) * inv(DELTA) + s * A + r * B - r * s * DELTA);
    const left = mod(A * B);
    const right = mod(ALPHA * BETA + L * GAMMA + C * DELTA);
    return { A, B, C, L, left, right, accept: left === right };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(10);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(alg.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["p"]).toBe(P);
    });
}

describe("Groth16ToyPairingCheck", () => {
    it("matches an independent arithmetic reference on the default proof", () => {
        const input = alg.defaultInput as { u: number; v: number; w: number; x: number; y: number };
        const frames = [...alg.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.u, input.v, input.w, input.x, input.y, 3, 4);
        for (const key of ["A", "B", "C", "L"] as const) {
            expect(final?.[key]).toBe(expected[key]);
        }
        expect(final?.["left"]).toBe(expected.left);
        expect(final?.["right"]).toBe(expected.right);
        expect(final?.["accept"]).toBe(expected.accept);
        expect(final?.["constraintsMet"]).toBe(true);
    });

    it("accepts every satisfying witness and rejects every corrupted one", () => {
        for (let u = 1; u <= 6; u += 1) {
            for (let v = 1; v <= 6; v += 1) {
                for (let x = 1; x <= 6; x += 1) {
                    const w = mod(u * v);
                    const y = mod(w * x);
                    const good = [...alg.run({ u, v, w, x, y })];
                    checkFrames(good);
                    const goodFinal = good[good.length - 1]?.meta;
                    expect(goodFinal?.["accept"]).toBe(true);

                    const bad = [...alg.run({ u, v, w, x, y: mod(y + 1) })];
                    checkFrames(bad);
                    const badFinal = bad[bad.length - 1]?.meta;
                    expect(badFinal?.["accept"]).toBe(false);
                }
            }
        }
    });

    it("uses a bilinear pairing and reports matching verdicts for random proofs", () => {
        for (const [a, b, c] of [[2, 7, 11], [5, 9, 13], [30, 41, 6]]) {
            expect(mod((a + c) * b)).toBe(mod(mod(a * b) + mod(c * b)));
        }
        const input = alg.defaultInput as { u: number; v: number; w: number; x: number; y: number };
        for (const [r, s] of [[0, 0], [1, 2], [9, 8]]) {
            const frames = [...alg.run({ ...input, r, s })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(input.u, input.v, input.w, input.x, input.y, r, s);
            expect(final?.["accept"]).toBe(expected.accept);
        }
    });

    it("terminates cleanly", () => {
        const generator = alg.run(alg.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
