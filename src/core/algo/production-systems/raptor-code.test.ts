/** raptor-code.test.ts - GF(2) solver property, encode/decode round trip, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { raptorDecode, raptorEncode, solveGF2, type Gf2Row } from "./raptor-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Raptor Fountain Code (teaching model)", () => {
    it("solves full-rank xor systems and rejects short or inconsistent ones", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 4 + (trial % 5);
            const secret = Array.from({ length: n }, (_, i) => (trial * (i + 3) + i * i) % 256);
            const rows: Gf2Row[] = [];
            for (let i = 0; i < n; i += 1) {
                let coeff = 1n << BigInt(i);
                let rhs = secret[i]!;
                if (i > 0) {
                    coeff |= 1n << BigInt(i - 1);
                    rhs ^= secret[i - 1]!;
                }
                rows.push({ coeff, rhs });
            }
            const solution = solveGF2(rows, n);
            expect(solution).not.toBeNull();
            for (const r of rows) {
                let xorValue = 0;
                for (let i = 0; i < n; i += 1) if ((r.coeff & (1n << BigInt(i))) !== 0n) xorValue ^= solution![i]!;
                expect(xorValue).toBe(r.rhs);
            }
            expect(solveGF2(rows.slice(0, n - 1), n)).toBeNull();
        }
        expect(solveGF2([{ coeff: 1n, rhs: 5 }, { coeff: 1n, rhs: 6 }], 1)).toBeNull();
    });

    it("round-trips random source blocks through droplets", () => {
        for (let seed = 1; seed <= 30; seed += 1) {
            const source = Array.from({ length: 4 }, (_, i) => (seed * (i + 5) * 7) % 256);
            const droplets = raptorEncode(source, seed, 4 + 2 + 10, 2);
            const decoded = raptorDecode(droplets, 4, 2);
            expect(decoded.success).toBe(true);
            expect(decoded.source).toEqual(source);
        }
    });

    it("fails cleanly when too few droplets are collected", () => {
        const source = [10, 20, 30, 40];
        const droplets = raptorEncode(source, 3, 2, 2);
        expect(raptorDecode(droplets, 4, 2).success).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        expect(final["done"]).toBe(true);
        expect(final["success"]).toBe(1);
        expect(generator.next().done).toBe(true);
    });
});
