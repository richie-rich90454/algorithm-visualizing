/**
 * fn-dsa-falcon.test.ts - Preimage equation and shortness checks, tamper
 * rejection, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { hash32 } from "./fn-dsa-falcon";
import type { VisualFrame } from "@/types";

const modq = (value: number, q: number): number => ((value % q) + q) % q;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(24);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Falcon / GPV Preimage Core", () => {
    it("satisfies the public equation and shortness bound for the true secret", () => {
        const input = mod.defaultInput as { message: string; seed: number; n: number; q: number; bound: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;

        const q = Number(final?.["q"]);
        const n = Number(final?.["n"]);
        const s = final?.["s"] as number[];
        const H = final?.["H"] as number[];
        const representative = final?.["representative"] as number[];
        expect(s.length).toBe(n);
        expect(H.length).toBe(n * n);
        expect(s.every((value) => Math.abs(value) <= input.bound)).toBe(true);

        for (let i = 0; i < n; i += 1) {
            let product = 0;
            for (let j = 0; j < n; j += 1) {
                product += (H[i * n + j] ?? 0) * (s[j] ?? 0);
            }
            expect(representative[i]).toBe(modq(product, q));
            expect((final?.["image"] as number[])[i]).toBe(representative[i]);
        }
        expect(final?.["shortOk"]).toBe(true);
        expect(final?.["equationOk"]).toBe(true);
        expect(final?.["verified"]).toBe(true);
    });

    it("rejects tampered signatures across several messages and seeds", () => {
        for (const message of ["hello", "lattice", "verify me"]) {
            for (const seed of [1, 2026, 99991]) {
                const accepted = [...mod.run({ message, seed })];
                const good = accepted[accepted.length - 1]?.meta;
                const s = good?.["s"] as number[];
                const tampered = [...s];
                tampered[0] = (tampered[0] ?? 0) + 2;
                const rejected = [...mod.run({ message, seed, signature: tampered })];
                checkFrames(rejected);
                const final = rejected[rejected.length - 1]?.meta;
                expect(final?.["verified"]).toBe(false);
                expect(final?.["equationOk"]).toBe(false);
            }
        }
    });

    it("rejects an oversized but equation-preserving signature", () => {
        const input = mod.defaultInput as { message: string; seed: number; n: number; q: number; bound: number };
        const frames = [...mod.run(input)];
        const good = frames[frames.length - 1]?.meta;
        const q = Number(good?.["q"]);
        const s = good?.["s"] as number[];
        // Shifting every entry by q leaves the product unchanged modulo q but
        // makes the vector far too long, isolating the shortness check.
        const oversized = s.map((value) => value + q);
        const rejected = [...mod.run({ ...input, signature: oversized })];
        const final = rejected[rejected.length - 1]?.meta;
        expect(final?.["equationOk"]).toBe(true);
        expect(final?.["shortOk"]).toBe(false);
        expect(final?.["verified"]).toBe(false);
    });

    it("derives the message digest deterministically", () => {
        expect(hash32("hello")).toBe(hash32("hello"));
        expect(hash32("hello")).not.toBe(hash32("hello!"));
        const a = [...mod.run({ message: "hello" })];
        const b = [...mod.run({ message: "hello!" })];
        expect(a[a.length - 1]?.meta["representative"]).not.toEqual(
            b[b.length - 1]?.meta["representative"],
        );
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
