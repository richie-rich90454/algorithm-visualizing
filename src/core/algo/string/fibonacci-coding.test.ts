import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./fibonacci-coding";

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

function decode(bits: string): number[] {
    const out: number[] = [];
    const f = [1, 2];
    while (f[f.length - 1]! < 1 << 20) f.push(f[f.length - 1]! + f[f.length - 2]!);
    let start = 0;
    for (let i = 1; i < bits.length; i += 1) {
        if (bits[i - 1] === "1" && bits[i] === "1") {
            const digits = bits.slice(start, i);
            let sum = 0;
            for (let j = 0; j < digits.length && j < f.length; j += 1) {
                if (digits[j] === "1") sum += f[j]!;
            }
            out.push(sum);
            start = i + 1;
            i += 1;
        }
    }
    return out;
}

describe("FibonacciCoding", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("Zeckendorf codes split on 11 and decode back via an independent decoder", () => {
        for (const nums of [[1, 2, 3, 4, 5, 6], [1], [7, 12, 40, 100]]) {
            const frames = [...module.run({ numbers: nums })];
            const last = frames[frames.length - 1]!;
            const bits = String(last.meta.bits);
            expect(decode(bits)).toEqual(nums);
            expect(bits.endsWith("11")).toBe(true);
            expect(last.meta.roundTrip).toBe(true);
        }
    });
});
