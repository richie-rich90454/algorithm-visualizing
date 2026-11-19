/** goldreich-micali-wigderson.test.ts - Exhaustive share-split correctness, OT table check, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { andGate, andTable, otSelect, reconstruct, xorGate } from "./goldreich-micali-wigderson";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("GMW Two-Party Boolean Circuit (toy)", () => {
    it("matches the plain circuit for every input and share split", () => {
        for (let x = 0; x < 2; x += 1) {
            for (let y = 0; y < 2; y += 1) {
                for (let z = 0; z < 2; z += 1) {
                    for (let x1 = 0; x1 < 2; x1 += 1) {
                        for (let y1 = 0; y1 < 2; y1 += 1) {
                            for (let z1 = 0; z1 < 2; z1 += 1) {
                                for (let mask = 0; mask < 2; mask += 1) {
                                    const xs: [number, number] = [x1, x ^ x1];
                                    const ys: [number, number] = [y1, y ^ y1];
                                    const zs: [number, number] = [z1, z ^ z1];
                                    expect(reconstruct(xs)).toBe(x);
                                    expect(reconstruct(ys)).toBe(y);
                                    expect(reconstruct(zs)).toBe(z);
                                    const andShares = andGate(xs, ys, mask);
                                    expect(reconstruct(andShares)).toBe(x & y);
                                    const final = xorGate(andShares, zs);
                                    expect(reconstruct(final)).toBe(((x & y) ^ z));
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    it("the OT table entries are the masked products and only one is selected", () => {
        for (let x1 = 0; x1 < 2; x1 += 1) {
            for (let y1 = 0; y1 < 2; y1 += 1) {
                for (let mask = 0; mask < 2; mask += 1) {
                    const table = andTable(x1, y1, mask);
                    for (let a = 0; a < 2; a += 1) {
                        for (let b = 0; b < 2; b += 1) {
                            expect(table[a * 2 + b]).toBe(((x1 ^ a) & (y1 ^ b)) ^ mask);
                            expect(otSelect(table, a, b)).toBe(table[a * 2 + b]);
                        }
                    }
                }
            }
        }
    });

    it("a single party's share takes both values across splits", () => {
        const p1 = new Set<number>();
        const p2 = new Set<number>();
        for (let x1 = 0; x1 < 2; x1 += 1) {
            p1.add(x1);
            p2.add(1 ^ x1);
        }
        expect(p1.size).toBe(2);
        expect(p2.size).toBe(2);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["output"]).toBe(((1 ^ 1) & (0 ^ 1)) ^ (1 ^ 0));
        expect(final?.meta["output"]).toBe(final?.meta["expected"]);
        expect(generator.next().done).toBe(true);
    });
});
