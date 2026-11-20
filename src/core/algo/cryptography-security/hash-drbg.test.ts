/**
 * hash-drbg.test.ts - Independent state-machine replay, stream properties,
 * frame shape checks, and termination for the Hash_DRBG teaching model.
 */

import { describe, expect, it } from "vitest";
import mod, { HashDrbg, toyHash } from "./hash-drbg";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(48);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(16);
        expect(typeof frame.meta["setupV"]).toBe("string");
    });
}

/** Independent replay of the Hash_DRBG state machine. */
function reference(entropy: number[], nonce: number, personalization: number[], bytes: number, reseed: number[]) {
    const n = nonce >>> 0;
    const seed = [...entropy, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, ...personalization];
    let v = toyHash([0x00, ...seed]);
    let c = toyHash([0x01, ...v, ...seed]);
    const generate = (): number[] => {
        const out: number[] = [];
        while (out.length < bytes) {
            out.push(...toyHash([0x02, ...v]));
            v = toyHash([0x03, ...v]);
        }
        return out.slice(0, bytes);
    };
    const first = generate();
    const second = generate();
    v = toyHash([0x04, ...v, ...reseed]);
    c = toyHash([0x05, ...v, ...reseed]);
    return { v, c, first, second, third: generate() };
}

describe("Hash_DRBG (toy hash)", () => {
    it("has a deterministic sixteen-byte toy hash", () => {
        for (let i = 0; i < 40; i += 1) {
            const data = Array.from({ length: i }, (_, j) => (i * 17 + j * 31) & 0xff);
            expect(toyHash(data).length).toBe(16);
            expect(toyHash(data)).toEqual(toyHash(data));
            expect(toyHash(data).every((b) => b >= 0 && b <= 255)).toBe(true);
        }
        expect(toyHash([])).toEqual(toyHash([]));
        expect(toyHash([1])).not.toEqual(toyHash([2]));
    });

    it("matches an independent replay of instantiate, generate, and reseed", () => {
        const input = mod.defaultInput as {
            entropy: number[];
            nonce: number;
            personalization: number[];
            bytes: number;
            reseedMaterial: number[];
        };
        const expected = reference(input.entropy, input.nonce, input.personalization, input.bytes, input.reseedMaterial);
        const drbg = new HashDrbg(input.entropy, input.nonce, input.personalization);
        expect(drbg.v).toEqual(toyHash([0x00, ...input.entropy, (input.nonce >>> 24) & 0xff, (input.nonce >>> 16) & 0xff, (input.nonce >>> 8) & 0xff, input.nonce & 0xff, ...input.personalization]));
        expect(drbg.generate(input.bytes)).toEqual(expected.first);
        expect(drbg.generate(input.bytes)).toEqual(expected.second);
        drbg.reseed(input.reseedMaterial);
        expect(drbg.v).toEqual(expected.v);
        expect(drbg.c).toEqual(expected.c);
        expect(drbg.generate(input.bytes)).toEqual(expected.third);
        expect(drbg.reseedCounter).toBe(2);
    });

    it("produces requested lengths, advances state, and reacts to reseeding", () => {
        for (let count = 1; count <= 40; count += 1) {
            const a = new HashDrbg([1, 2, 3], 4);
            expect(a.generate(count).length).toBe(count);
        }
        const a = new HashDrbg([7, 8], 1);
        const first = a.generate(8);
        expect(a.generate(8)).not.toEqual(first);
        const b = new HashDrbg([7, 8], 1);
        expect(b.generate(8)).toEqual(first);
        const c = new HashDrbg([7, 9], 1);
        expect(c.generate(8)).not.toEqual(first);
        const d = new HashDrbg([7, 8], 1);
        d.generate(8);
        d.reseed([55]);
        expect(d.generate(8)).not.toEqual(a.generate(8));
    });

    it("emits well-formed frames matching a fresh run", () => {
        const input = mod.defaultInput as {
            entropy: number[];
            nonce: number;
            personalization: number[];
            bytes: number;
            reseedMaterial: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.entropy, input.nonce, input.personalization, input.bytes, input.reseedMaterial);
        const last = frames[frames.length - 1]!.meta;
        expect(last["first"]).toBe(expected.first.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(""));
        expect(last["second"]).toBe(expected.second.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(""));
        expect(last["postReseed"]).toBe(expected.third.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(""));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(4);
        expect(gen.next().done).toBe(true);
    });
});
