import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./elias-omega-coding";

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

function decodeOne(bits: string, pos: { i: number }): number {
    if (bits[pos.i] === "1") {
        pos.i += 1;
        return 1;
    }
    pos.i += 1;
    const length = decodeOne(bits, pos);
    const rest = bits.slice(pos.i, pos.i + length);
    pos.i += length;
    return parseInt("1" + rest, 2);
}

function decode(bits: string): number[] {
    const out: number[] = [];
    const pos = { i: 0 };
    while (pos.i < bits.length) out.push(decodeOne(bits, pos));
    return out;
}

describe("EliasOmegaCoding", () => {
    it("terminates with well-formed frames", () => {
        const frames = [...module.run(module.defaultInput)];
        checkFrames(frames);
    });

    it("recursively encoded stream decodes back via an independent decoder", () => {
        for (const nums of [[1, 2, 3, 4, 5], [1], [2, 7, 31], [10, 100, 1000]]) {
            const frames = [...module.run({ numbers: nums })];
            const last = frames[frames.length - 1]!;
            expect(decode(String(last.meta.bits))).toEqual(nums);
            expect(last.meta.roundTrip).toBe(true);
        }
    });
});
