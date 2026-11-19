/** scrypt.test.ts - Independent reference for the toy KDF, closed form at N=1, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { blockMix, pbkdf2Words, prf, romix, scryptKdf } from "./scrypt";
import type { VisualFrame } from "@/types";

const F = (bytes: number[]): number => {
    let h = 2166136261;
    for (const b of bytes) { h = Math.imul(h ^ (b & 0xff), 16777619) >>> 0; }
    return h >>> 0;
};
const refPrf = (key: number[], msg: number[]): number[] => [0, 1, 2, 3].map((i) => F([...key, i, ...msg]));
const ib = (v: number): number[] => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];

function refPbkdf2(pw: number[], salt: number[], iter: number, count: number): number[] {
    const out: number[] = [];
    let b = 1;
    while (out.length < count) {
        let u = refPrf(pw, [...salt, ...ib(b)]);
        const t = [...u];
        for (let c = 1; c < iter; c += 1) {
            u = refPrf(pw, u);
            for (let k = 0; k < 4; k += 1) { t[k] = (t[k] ?? 0) ^ (u[k] ?? 0); }
        }
        out.push(...t);
        b += 1;
    }
    return out.slice(0, count);
}

function refMix(x0: number[]): number[] {
    let y = x0.slice(0, 8);
    for (let r = 0; r < 4; r += 1) {
        const next: number[] = [];
        for (let i = 0; i < 8; i += 1) {
            const v = y[i] ?? 0;
            next.push(((v + (y[(i + 1) % 8] ?? 0)) ^ ((v << 3) | (v >>> 29))) >>> 0);
        }
        y = next;
    }
    return y;
}
function refBlockMix(block: number[]): number[] {
    const ys: number[][] = [];
    let x = new Array<number>(8).fill(0);
    for (let c = 0; c < 2; c += 1) {
        for (let i = 0; i < 8; i += 1) { x[i] = (x[i] ?? 0) ^ (block[c * 8 + i] ?? 0); }
        x = refMix(x);
        ys.push([...x]);
    }
    return [...ys[1]!, ...ys[0]!];
}
function refRomix(block: number[], n: number): number[] {
    let x = [...block];
    const mem: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        mem.push([...x]);
        x = refBlockMix(x.map((v, j) => v ^ (block[j] ?? 0)));
    }
    for (let i = 0; i < n; i += 1) {
        const j = (x[0] ?? 0) % n;
        x = refBlockMix(x.map((v, k) => v ^ (mem[j]![k] ?? 0)));
    }
    return x;
}

const bytes = (s: string): number[] => Array.from(new TextEncoder().encode(s));

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.length).toBeLessThanOrEqual(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Scrypt Password KDF (toy model)", () => {
    it("matches the independent reference across random small inputs", () => {
        for (const password of ["", "pw", "password"]) {
            for (const salt of ["", "s", "salt"]) {
                for (const n of [1, 2, 5, 16]) {
                    const pw = bytes(password);
                    const sa = bytes(salt);
                    expect(prf(pw, sa)).toEqual(refPrf(pw, sa));
                    expect(pbkdf2Words(pw, sa, 1, 16)).toEqual(refPbkdf2(pw, sa, 1, 16));
                    expect(blockMix(pbkdf2Words(pw, sa, 1, 16))).toEqual(refBlockMix(refPbkdf2(pw, sa, 1, 16)));
                    expect(romix(pbkdf2Words(pw, sa, 1, 16), n)).toEqual(refRomix(refPbkdf2(pw, sa, 1, 16), n));
                    expect(scryptKdf(pw, sa, n, 8)).toEqual(refPbkdf2(pw, refRomix(refPbkdf2(pw, sa, 1, 16), n), 1, 8));
                }
            }
        }
    });

    it("has the correct closed form when cost is one", () => {
        const pw = bytes("password");
        const sa = bytes("salt");
        const expanded = pbkdf2Words(pw, sa, 1, 16);
        const zero = new Array<number>(16).fill(0);
        const expected = blockMix(blockMix(zero).map((v, i) => v ^ (expanded[i] ?? 0)));
        expect(romix(expanded, 1)).toEqual(expected);
    });

    it("is deterministic and sensitive to password, salt, and cost", () => {
        const a = scryptKdf(bytes("password"), bytes("salt"), 8, 4);
        expect(a).toEqual(scryptKdf(bytes("password"), bytes("salt"), 8, 4));
        expect(a).not.toEqual(scryptKdf(bytes("passworx"), bytes("salt"), 8, 4));
        expect(a).not.toEqual(scryptKdf(bytes("password"), bytes("salt2"), 8, 4));
        expect(a).not.toEqual(scryptKdf(bytes("password"), bytes("salt"), 16, 4));
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["derivedKey"]).toBeDefined();
        expect(typeof final?.meta["derivedKey"]).toBe("string");
        expect(generator.next().done).toBe(true);
    });
});
