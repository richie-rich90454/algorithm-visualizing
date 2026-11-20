/**
 * superdense-coding.test.ts - Explicit matrix circuit reference, round-trip property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./superdense-coding";
import type { VisualFrame } from "@/types";

const S = 1 / Math.sqrt(2);

/** Independent explicit-matrix simulation of the whole protocol. */
function reference(bits: string): number[] {
    const I4 = [1, 0, 0, 0];
    let v = [S * I4[0]!, 0, 0, S];
    const xFirst = (s: number[]) => [s[2]!, s[3]!, s[0]!, s[1]!];
    const zFirst = (s: number[]) => [s[0]!, s[1]!, -s[2]!, -s[3]!];
    const cnot = (s: number[]) => [s[0]!, s[1]!, s[3]!, s[2]!];
    const hFirst = (s: number[]) => [
        (s[0]! + s[2]!) * S,
        (s[1]! + s[3]!) * S,
        (s[0]! - s[2]!) * S,
        (s[1]! - s[3]!) * S,
    ];
    if (bits === "01") v = xFirst(v);
    else if (bits === "10") v = zFirst(v);
    else if (bits === "11") v = zFirst(xFirst(v));
    v = hFirst(cnot(v));
    return v;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.reduce((s, a) => s + a * a, 0)).toBeCloseTo(1, 12);
    });
}

describe("SuperdenseCoding", () => {
    it("matches an explicit matrix circuit for all four messages", () => {
        for (const bits of ["00", "01", "10", "11"]) {
            const frames = [...mod.run({ bits })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(bits);
            const amps = final?.["amplitudes"] as number[];
            for (let i = 0; i < 4; i += 1) {
                expect(amps[i]).toBeCloseTo(expected[i]!, 12);
            }
            expect(final?.["decoded"]).toBe(bits);
        }
    });

    it("decodes exactly one basis state with unit probability", () => {
        for (const bits of ["00", "01", "10", "11"]) {
            const frames = [...mod.run({ bits })];
            const amps = frames[frames.length - 1]?.meta["amplitudes"] as number[];
            const index = Number.parseInt(bits, 2);
            for (let i = 0; i < 4; i += 1) {
                expect(Math.abs(amps[i]!)).toBeCloseTo(i === index ? 1 : 0, 12);
            }
        }
    });

    it("falls back to the default message on malformed input", () => {
        const frames = [...mod.run({ bits: "xyz" })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["decoded"]).toBe("10");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
