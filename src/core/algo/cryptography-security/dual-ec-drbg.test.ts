/**
 * dual-ec-drbg.test.ts - Backdoor recovery brute force, determinism, frame
 * shape checks, and termination for the toy Dual_EC_DRBG model.
 */

import { describe, expect, it } from "vitest";
import mod, { BACKDOOR_D, DROP_BITS, PRIME, Q, DualEcDrbg, modInverse, modPow, recoverState } from "./dual-ec-drbg";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(24);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(8);
        expect(frame.meta["backdoorWorks"]).toBe(true);
    });
}

describe("Dual_EC_DRBG backdoor (toy group)", () => {
    it("derives Q from P and inverts group elements", () => {
        expect(Q).toBe(modPow(2, BACKDOOR_D, PRIME));
        expect((2 * modInverse(2, PRIME)) % PRIME).toBe(1);
        expect(DROP_BITS).toBe(2);
    });

    it("is deterministic and advances the state", () => {
        for (let seed = 1; seed <= 60; seed += 1) {
            const a = new DualEcDrbg(seed);
            const b = new DualEcDrbg(seed);
            expect(a.generate(4)).toEqual(b.generate(4));
            const outputs = new DualEcDrbg(seed).generate(4);
            expect(new Set(outputs).size).toBeGreaterThan(1);
            expect(outputs.every((v) => v >= 0 && v < PRIME / 2 ** DROP_BITS)).toBe(true);
        }
        expect(new DualEcDrbg(1).generate(3)).not.toEqual(new DualEcDrbg(2).generate(3));
    });

    it("brute-forces dropped bits to recover the state and predict the next output", () => {
        for (let seed = 1; seed <= 200; seed += 1) {
            const drbg = new DualEcDrbg(seed);
            const initial = drbg.state;
            const outputs = drbg.generate(3);
            const recovered = recoverState(outputs[0]!, outputs[1]!);
            expect(recovered).toBe(initial);
            const thirdFull = (((recovered! * Q) % PRIME) * Q % PRIME) * 2 % PRIME;
            expect(Math.floor(thirdFull / 2 ** DROP_BITS)).toBe(outputs[2]);
        }
    });

    it("fails recovery without the correct backdoor exponent", () => {
        let failures = 0;
        for (let seed = 1; seed <= 60; seed += 1) {
            const outputs = new DualEcDrbg(seed).generate(2);
            if (recoverState(outputs[0]!, outputs[1]!, BACKDOOR_D + 1) === null) failures += 1;
        }
        expect(failures).toBeGreaterThan(45);
    });

    it("emits well-formed frames matching a fresh run", () => {
        const input = mod.defaultInput as { seed: number; outputs: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = new DualEcDrbg(input.seed).generate(input.outputs);
        expect(frames[frames.length - 1]!.meta["outputs"]).toEqual(expected);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(5);
        expect(gen.next().done).toBe(true);
    });
});
