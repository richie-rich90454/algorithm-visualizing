import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./golomb-rice-coding";

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

function decode(bits: string, k: number): number[] {
    const out: number[] = [];
    let i = 0;
    while (i < bits.length) {
        let q = 0;
        while (bits[i] === "1") { q += 1; i += 1; }
        if (bits[i] !== "0") break;
        i += 1;
        const rem = bits.slice(i, i + k);
        out.push(q * (1 << k) + (rem === "" ? 0 : parseInt(rem, 2)));
        i += k;
    }
    return out;
}

describe("GolombRiceCoding", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("unary quotient plus k-bit remainder decodes back via an independent decoder", () => {
        for (const cfg of [
            { numbers: [0, 1, 2, 3, 4, 5, 6, 7], k: 2 },
            { numbers: [0, 9, 31, 100], k: 3 },
            { numbers: [5, 17, 42], k: 1 },
            { numbers: [0, 1, 2], k: 0 },
        ]) {
            const frames = [...module.run(cfg)];
            const last = frames[frames.length - 1]!;
            expect(decode(String(last.meta.bits), cfg.k)).toEqual(cfg.numbers);
            expect(last.meta.roundTrip).toBe(true);
        }
    });
});
