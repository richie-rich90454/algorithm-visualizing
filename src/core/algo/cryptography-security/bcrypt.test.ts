/** bcrypt.test.ts - Independent toy EksBlowfish reference, cost/salt properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { bcryptHash, expandKey, toyEncrypt } from "./bcrypt";
import type { VisualFrame } from "@/types";

const N = 18;
const R = 6;
const init = (): number[] => Array.from({ length: N }, (_, i) => Math.imul(i + 1, 0x9e3779b9) >>> 0);

function refEncrypt(s: number[], L0: number, R0: number): [number, number] {
    let L = L0 >>> 0;
    let Rr = R0 >>> 0;
    for (let r = 0; r < R; r += 1) {
        const k = s[r] ?? 0;
        const sb = s[R + (Rr & 255)] ?? 0;
        const f = ((((Rr ^ k) << 3) | ((Rr ^ k) >>> 29)) + sb) >>> 0;
        const nl = Rr;
        const nr = (L ^ f) >>> 0;
        L = nl;
        Rr = nr;
    }
    return [L >>> 0, Rr >>> 0];
}
function refExpand(pw: number[], sa: number[], cost: number): number[] {
    const s = init();
    for (let i = 0; i < N; i += 1) {
        s[i] = (s[i]! ^ Math.imul((pw[i % Math.max(1, pw.length)] ?? 0) + 1, 0x01010101) ^
            Math.imul((sa[i % Math.max(1, sa.length)] ?? 0) + 1, 0x1b873593)) >>> 0;
    }
    let L = 0;
    let Rr = s.reduce((acc, v, i) => (acc + Math.imul(v, i + 1)) >>> 0, 0);
    for (let c = 0; c < 2 ** cost; c += 1) {
        [L, Rr] = refEncrypt(s, L, Rr);
        for (let i = 0; i < N; i += 2) {
            s[i] = L;
            s[i + 1] = Rr;
            [L, Rr] = refEncrypt(s, L, Rr);
        }
    }
    return s;
}
function refHash(pw: number[], sa: number[], cost: number): string {
    const s = refExpand(pw, sa, cost);
    let L = 0x42424242;
    let Rr = 0x4f796265;
    for (let i = 0; i < 64; i += 1) { [L, Rr] = refEncrypt(s, L, Rr); }
    return (L >>> 0).toString(16).padStart(8, "0") + (Rr >>> 0).toString(16).padStart(8, "0");
}
const bytes = (s: string): number[] => Array.from(new TextEncoder().encode(s));

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

describe("Bcrypt Password Hash (toy model)", () => {
    it("matches the independent reference across passwords, salts, and costs", () => {
        for (const pw of ["", "a", "password"]) {
            for (const sa of ["", "s", "salt"]) {
                for (const cost of [0, 1, 3]) {
                    const p = bytes(pw);
                    const s = bytes(sa);
                    expect(expandKey(p, s, cost)).toEqual(refExpand(p, s, cost));
                    expect(bcryptHash(p, s, cost)).toBe(refHash(p, s, cost));
                }
            }
        }
    });

    it("the toy cipher is a permutation on word pairs", () => {
        const s = expandKey(bytes("password"), bytes("salt"), 2);
        const seen = new Set<string>();
        for (let i = 0; i < 512; i += 1) {
            const [l, r] = toyEncrypt(s, i, 255 - i);
            seen.add(`${l}:${r}`);
        }
        expect(seen.size).toBe(512);
    });

    it("is deterministic and sensitive to password, salt, and cost", () => {
        const p = bytes("password");
        const s = bytes("salt");
        const base = bcryptHash(p, s, 3);
        expect(base).toBe(bcryptHash(p, s, 3));
        expect(base).not.toBe(bcryptHash(bytes("passworx"), s, 3));
        expect(base).not.toBe(bcryptHash(p, bytes("salt2"), 3));
        expect(base).not.toBe(bcryptHash(p, s, 4));
        expect(bcryptHash(p, s, 3)).toHaveLength(16);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["hash"]).toBe(bcryptHash(bytes("password"), bytes("salt"), 3));
        expect(generator.next().done).toBe(true);
    });
});
