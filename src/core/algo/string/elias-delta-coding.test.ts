import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./elias-delta-coding";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

/** Independent reference decoder for Elias delta. */
function decode(bits: string): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < bits.length) {
        let z = 0;
        while (bits[i] === "0") { z += 1; i += 1; }
        const lenBits = bits.slice(i, i + z + 1);
        if (lenBits.length < z + 1) break;
        const length = parseInt(lenBits, 2);
        i += z + 1;
        const rest = bits.slice(i, i + length - 1);
        out.push(parseInt("1" + rest, 2));
        i += length - 1;
    }
    return out;
}

describe("EliasDeltaCoding", () => {
    it("terminates with well-formed frames", () => {
        const frames = [...module.run(module.defaultInput)];
        checkFrames(frames);
    });

    it("emits a prefix-free stream that decodes back via an independent decoder", () => {
        const cases = [[1, 2, 3, 4, 5], [1], [2, 7, 31], [10, 100, 1000]];
        for (const nums of cases) {
            const frames = [...module.run({ numbers: nums })];
            const last = frames[frames.length - 1]!;
            expect(decode(String(last.meta.bits))).toEqual(nums);
            expect(last.meta.roundTrip).toBe(true);
        }
    });
});
