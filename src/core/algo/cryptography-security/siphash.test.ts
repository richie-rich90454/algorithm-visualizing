/** siphash.test.ts - Known vectors, independent reference, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./siphash";
import type { VisualFrame } from "@/types";

interface Input {
    message: string;
    key: number[];
}

const MASK = (1n << 64n) - 1n;

/** Independent SipHash-2-4 implementation using explicit imperative rounds. */
function reference(message: string, key: number[]): string {
    let k0 = 0n;
    let k1 = 0n;
    for (let i = 0; i < 8; i += 1) {
        k0 += BigInt(key[i] ?? 0) << BigInt(8 * i);
        k1 += BigInt(key[8 + i] ?? 0) << BigInt(8 * i);
    }
    const a = 0x736f6d6570736575n ^ k0;
    const b = 0x646f72616e646f6dn ^ k1;
    const c = 0x6c7967656e657261n ^ k0;
    const d = 0x7465646279746573n ^ k1;
    let v0 = a;
    let v1 = b;
    let v2 = c;
    let v3 = d;
    const rot = (x: bigint, n: number): bigint => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK;
    const sip = (): void => {
        v0 = (v0 + v1) & MASK;
        v1 = rot(v1, 13);
        v1 ^= v0;
        v0 = rot(v0, 32);
        v2 = (v2 + v3) & MASK;
        v3 = rot(v3, 16);
        v3 ^= v2;
        v0 = (v0 + v3) & MASK;
        v3 = rot(v3, 21);
        v3 ^= v0;
        v2 = (v2 + v1) & MASK;
        v1 = rot(v1, 17);
        v1 ^= v2;
        v2 = rot(v2, 32);
    };
    const bytes: number[] = [];
    for (let i = 0; i < message.length; i += 1) {
        bytes.push(message.charCodeAt(i) & 0xff);
    }
    let offset = 0;
    for (; offset + 8 <= bytes.length; offset += 8) {
        let m = 0n;
        for (let j = 0; j < 8; j += 1) {
            m += BigInt(bytes[offset + j] ?? 0) << BigInt(8 * j);
        }
        v3 ^= m;
        sip();
        sip();
        v0 ^= m;
    }
    let last = BigInt(bytes.length & 0xff) << 56n;
    let shift = 0n;
    for (let j = offset; j < bytes.length; j += 1) {
        last += BigInt(bytes[j] ?? 0) << shift;
        shift += 8n;
    }
    v3 ^= last;
    sip();
    sip();
    v0 ^= last;
    v2 ^= 0xffn;
    for (let i = 0; i < 4; i += 1) {
        sip();
    }
    const out = (v0 ^ v1 ^ v2 ^ v3) & MASK;
    return out.toString(16).padStart(16, "0");
}

function hashOf(input: Input): string {
    const frames = [...mod.run(input)];
    return String(frames[frames.length - 1]?.meta["hash"]);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SipHash", () => {
    const key = Array.from({ length: 16 }, (_, i) => i);

    it("matches the published SipHash-2-4 vectors", () => {
        expect(hashOf({ message: "", key })).toBe("726fdb47dd0e0e31");
        expect(hashOf({ message: "\u0000", key })).toBe("74f839c593dc67fd");
    });

    it("agrees with an independent implementation on varied inputs", () => {
        for (const message of ["", "a", "abc", "The quick brown fox", "0123456789abcdef"]) {
            expect(hashOf({ message, key })).toBe(reference(message, key));
        }
    });

    it("has well-formed frames and terminates", () => {
        const input: Input = { message: "abcdefghijklm", key };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
