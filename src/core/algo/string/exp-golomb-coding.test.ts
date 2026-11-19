import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./exp-golomb-coding";

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
    let i = 0;
    while (i < bits.length) {
        let z = 0;
        while (bits[i] === "0") { z += 1; i += 1; }
        const chunk = bits.slice(i, i + z + 1);
        out.push(parseInt(chunk, 2) - 1);
        i += z + 1;
    }
    return out;
}

describe("ExpGolombCoding", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("unary-length stream decodes back via an independent decoder", () => {
        for (const nums of [[0, 1, 2, 3, 4, 5], [0], [1, 6, 15, 63]]) {
            const frames = [...module.run({ numbers: nums })];
            const last = frames[frames.length - 1]!;
            expect(decode(String(last.meta.bits))).toEqual(nums);
            expect(last.meta.roundTrip).toBe(true);
        }
    });
});
