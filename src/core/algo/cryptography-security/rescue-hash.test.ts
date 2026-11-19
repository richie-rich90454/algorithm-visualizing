/** rescue-hash.test.ts - Independent field reference, permutation, and diffusion checks. */

import { describe, expect, it } from "vitest";
import mod, { FIELD, INVERSE_EXPONENT, permute, powMod, rescueHash, sbox } from "./rescue-hash";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent straight-line reimplementation of the toy permutation. */
function referencePermute(a0: bigint, b0: bigint): [bigint, bigint] {
    let a = a0;
    let b = b0;
    const rc: bigint[][] = [[3n, 5n], [7n, 11n], [13n, 17n], [19n, 23n]];
    for (let round = 0; round < 4; round += 1) {
        const exp = round % 2 === 0 ? 5n : INVERSE_EXPONENT;
        const ea = powMod(a, exp, FIELD);
        const eb = powMod(b, exp, FIELD);
        a = (2n * ea + eb + (rc[round]?.[0] ?? 0n)) % FIELD;
        b = (ea + 3n * eb + (rc[round]?.[1] ?? 0n)) % FIELD;
    }
    return [a, b];
}

describe("Rescue hash toy model", () => {
    it("uses an invertible power map", () => {
        expect((5n * INVERSE_EXPONENT) % (FIELD - 1n)).toBe(1n);
        const values = new Set<bigint>();
        for (let x = 0; x <= 60; x += 1) values.add(sbox(BigInt(x)));
        expect(values.size).toBe(61);
        expect(powMod(3n, 5n, FIELD)).toBe(243n);
    });

    it("matches an independent reimplementation of the permutation and hash", () => {
        for (const [a, b] of [[0n, 0n], [1n, 2n], [12345n, 67890n], [FIELD - 1n, 7n]] as const) {
            expect(permute([a, b])).toEqual(referencePermute(a, b));
        }
        for (let seed = 0; seed < 20; seed += 1) {
            const inputs = [seed, seed + 1, seed * 3, 17];
            let state: [bigint, bigint] = [0n, 0n];
            for (const value of inputs) {
                state = referencePermute((state[0] + BigInt(value)) % FIELD, state[1]);
            }
            expect(rescueHash(inputs)).toEqual(state);
        }
    });

    it("is deterministic, collision-free on a small sample, and diffuses changes", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 60; i += 1) {
            const digest = rescueHash([i, i + 1, 5]);
            expect(digest).toEqual(rescueHash([i, i + 1, 5]));
            seen.add(digest.join(","));
        }
        expect(seen.size).toBe(60);
        const base = rescueHash([1, 2, 3]);
        const changed = rescueHash([1, 9, 3]);
        expect(changed).not.toEqual(base);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["digest"]).toEqual(rescueHash([1, 2, 3, 4]).map(String));
        expect(generator.next().done).toBe(true);
    });
});
