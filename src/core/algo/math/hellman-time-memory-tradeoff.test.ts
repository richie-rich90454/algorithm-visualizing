import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./hellman-time-memory-tradeoff";

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

describe("Hellman Time-Memory Tradeoff", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("inverts a stored endpoint and never reports a false predecessor", () => {
        const base = { n: 10007, a: 445, b: 3391, chains: 48, chainLength: 60, seed: 7 };
        const probe = [...module.run(base)];
        checkFrames(probe);
        const endpoints = probe[probe.length - 1]!.meta.endpoints as string[];
        expect(endpoints.length).toBeGreaterThan(0);

        const target = Number(endpoints[0]!);
        const frames = [...module.run({ ...base, target })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!;
        expect(last.meta.verified).toBe(true);
        const preimage = BigInt(last.meta.preimage as string);
        const expected = BigInt(target);
        const n = BigInt(base.n);
        expect((445n * preimage + 3391n) % n).toBe(expected);
    });
});
