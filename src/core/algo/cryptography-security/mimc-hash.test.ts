import { describe, expect, it } from "vitest";
import mod, { mimcHash } from "./mimc-hash";
import type { VisualFrame } from "@/types";

/** Independent BigInt reference for the cube-round compression. */
function reference(message: string, key: number, rounds: number, prime: number): number {
    const p = BigInt(prime);
    const k = BigInt(key);
    let state = 0n;
    for (let i = 0; i < message.length; i += 1) {
        const word = BigInt(message.charCodeAt(i));
        for (let round = 0; round < rounds; round += 1) {
            const value = (state + word + k + BigInt(round)) % p;
            state = (value * value * value) % p;
        }
    }
    return Number(state);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 7);
        expect(frame.meta).toBeDefined();
    });
}

describe("MiMC Hash (Toy Field Model)", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        const input = mod.defaultInput as { message: string; key: number; rounds: number; prime: number };
        expect(last?.meta["hash"]).toBe(reference(input.message, input.key, input.rounds, input.prime));
        expect(generator.next().done).toBe(true);
    });

    it("matches an independent reference and is deterministic", () => {
        const cases = [
            { message: "a", key: 0, rounds: 1, prime: 1009 },
            { message: "hello", key: 7, rounds: 4, prime: 1000003 },
            { message: "xyz", key: 123, rounds: 8, prime: 2147483647 },
            { message: "", key: 5, rounds: 3, prime: 101 },
        ];
        for (const testCase of cases) {
            const result = mimcHash(testCase.message, testCase.key, testCase.rounds, testCase.prime);
            expect(result.hash).toBe(reference(testCase.message, testCase.key, testCase.rounds, testCase.prime));
            expect(mimcHash(testCase.message, testCase.key, testCase.rounds, testCase.prime).hash).toBe(result.hash);
            expect(result.states[result.states.length - 1]).toBe(result.hash);
            expect(result.hash).toBeGreaterThanOrEqual(0);
            expect(result.hash).toBeLessThan(testCase.prime);
        }
    });

    it("changes the digest when the message or key changes", () => {
        const base = mimcHash("abc", 11, 6, 1000003).hash;
        expect(mimcHash("abd", 11, 6, 1000003).hash).not.toBe(base);
        expect(mimcHash("abc", 12, 6, 1000003).hash).not.toBe(base);
    });
});
