/** index-calculus-discrete-log.test.ts - Brute-force log cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./index-calculus-discrete-log";
import type { VisualFrame } from "@/types";

function modPow(a: number, e: number, m: number): number {
    let r = 1 % m;
    let b = ((a % m) + m) % m;
    let x = e;
    while (x > 0) {
        if (x % 2 === 1) r = (r * b) % m;
        b = (b * b) % m;
        x = Math.floor(x / 2);
    }
    return r;
}
function bruteLog(p: number, g: number, h: number): number {
    let value = 1 % p;
    for (let e = 0; e < p - 1; e += 1) {
        if (value === ((h % p) + p) % p) return e;
        value = (value * g) % p;
    }
    return -1;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Index calculus discrete log", () => {
    it("recovers the discrete log and verifies the factor-base logs", () => {
        const cases = [
            { p: 101, g: 2, h: 83, bound: 13 },
            { p: 101, g: 2, h: 7, bound: 13 },
            { p: 101, g: 2, h: 54, bound: 13 },
            { p: 103, g: 5, h: 42, bound: 13 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["found"]).toBe(true);
            expect(final["verified"]).toBe(true);
            const log = Number(final["log"]);
            expect(modPow(input.g, log, input.p)).toBe(((input.h % input.p) + input.p) % input.p);
            const expected = bruteLog(input.p, input.g, input.h);
            expect(log).toBe(expected);

            const primes = final["factorBase"] as number[];
            const logs = (final["factorBaseLogs"] as string).split(";").map(Number);
            for (let i = 0; i < primes.length; i += 1) {
                expect(modPow(input.g, logs[i]!, input.p)).toBe(primes[i]!);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
