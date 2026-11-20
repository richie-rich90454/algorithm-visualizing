import { describe, expect, it } from "vitest";
import mod, { buildCHD, lookupCHD } from "./chd-minimal-perfect-hashing";

type Frame = ReturnType<typeof mod.run> extends Generator<infer F> ? F : never;

function checkFrames(frames: Frame[]): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 12);
        expect(frame.meta).toBeDefined();
    });
}

describe("CHD Minimal Perfect Hashing", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta.minimal).toBe(true);
        expect(Number(last?.meta.answer)).toBeGreaterThanOrEqual(0);
    });

    it("maps keys bijectively onto 0..n-1 and rejects absent keys", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const keys = Array.from(
                new Set(Array.from({ length: 8 }, () => Math.floor(Math.random() * 1000))),
            );
            const table = buildCHD(keys);
            const hashes = keys.map((key) => lookupCHD(table, key));
            expect(new Set(hashes).size).toBe(keys.length);
            for (const value of hashes) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThan(keys.length);
            }
            let absent = 0;
            while (hashes.length && absent < 5) {
                const candidate = 100000 + Math.floor(Math.random() * 100000);
                if (!keys.includes(candidate)) {
                    expect(lookupCHD(table, candidate)).toBe(-1);
                    absent += 1;
                }
            }
        }
    });

    it("handles a single-key set", () => {
        const table = buildCHD(["only"]);
        expect(lookupCHD(table, "only")).toBe(0);
        expect(lookupCHD(table, "other")).toBe(-1);
    });
});
