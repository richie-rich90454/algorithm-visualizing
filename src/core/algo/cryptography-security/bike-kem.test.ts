/** bike-kem.test.ts - Exhaustive syndrome decode check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { decode, errorVector, secretVector, sharedBit, syndrome } from "./bike-kem";
import type { VisualFrame } from "@/types";

const weight = (v: number[]): number => v.filter((b) => b === 1).length;
const eq = (a: number[], b: number[]): boolean => a.every((v, i) => v === b[i]);

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BIKE-Style QC-MDPC KEM (toy)", () => {
    it("sparse vectors have weight three", () => {
        for (let seed = 0; seed < 50; seed += 1) {
            expect(weight(secretVector(seed))).toBe(3);
            expect(weight(errorVector(seed))).toBe(3);
        }
    });

    it("the exhaustive decoder always recovers the encapsulated error and shared bit", () => {
        for (let keySeed = 0; keySeed < 20; keySeed += 1) {
            const secret = secretVector(keySeed);
            for (let messageSeed = 0; messageSeed < 20; messageSeed += 1) {
                const error = errorVector(messageSeed);
                const s = syndrome(secret, error);
                const recovered = decode(secret, s);
                expect(recovered).not.toBeNull();
                expect(eq(recovered!, error)).toBe(true);
                expect(eq(syndrome(secret, recovered!), s)).toBe(true);
                expect(sharedBit(recovered!)).toBe(sharedBit(error));
            }
        }
    });

    it("different errors usually give different syndromes and bits are stable", () => {
        const secret = secretVector(5);
        const seen = new Set<string>();
        for (let seed = 0; seed < 40; seed += 1) {
            const s = syndrome(secret, errorVector(seed));
            seen.add(s.join(""));
            const decoded = decode(secret, s);
            expect(sharedBit(decoded!)).toBe(sharedBit(errorVector(seed)));
        }
        expect(seen.size).toBeGreaterThan(10);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["agreed"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
