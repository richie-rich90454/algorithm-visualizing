/**
 * sigma-protocol.test.ts - Independent verification reference, completeness
 * and soundness checks, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sigma-protocol";
import type { VisualFrame } from "@/types";

function modpow(base: bigint, exp: bigint, m: bigint): bigint {
    let out = 1n;
    let b = ((base % m) + m) % m;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) out = (out * b) % m;
        b = (b * b) % m;
        e >>= 1n;
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.length).toBeLessThanOrEqual(6);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("sigma protocol", () => {
    it("matches an independent verification reference", () => {
        const cases = [
            { p: 1000003, g: 2, w: 12345, r: 6789 },
            { p: 101, g: 3, w: 42, r: 17 },
            { p: 1009, g: 11, w: 500, r: 250 },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const p = BigInt(c.p);
            const g = BigInt(c.g);
            const w = BigInt(c.w);
            const r = BigInt(c.r);
            const order = p - 1n;
            const h = modpow(g, w, p);
            const t = modpow(g, r, p);
            const challenge = BigInt((Number(t) * 2654435761) % Number(order)) + 1n;
            const response = (r + challenge * w) % order;
            const wantLeft = modpow(g, response, p);
            const wantRight = (t * modpow(h, challenge, p)) % p;
            expect(last?.["h"]).toBe(Number(h));
            expect(last?.["t"]).toBe(Number(t));
            expect(last?.["c"]).toBe(Number(challenge));
            expect(last?.["s"]).toBe(Number(response));
            expect(last?.["left"]).toBe(Number(wantLeft));
            expect(last?.["right"]).toBe(Number(wantRight));
            expect(last?.["accepts"]).toBe(true);
        }
    });

    it("rejects an incorrect secret in the verification equation", () => {
        const p = 1000003n;
        const g = 2n;
        const r = 6789n;
        const trueW = 12345n;
        const falseW = 12346n;
        const t = modpow(g, r, p);
        const c = BigInt((Number(t) * 2654435761) % Number(p - 1n)) + 1n;
        const sWrong = (r + c * falseW) % (p - 1n);
        const hTrue = modpow(g, trueW, p);
        const left = modpow(g, sWrong, p);
        const right = (t * modpow(hTrue, c, p)) % p;
        expect(left).not.toBe(right);
    });

    it("reports accept verdict on the honest default run", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["verdict"]).toBe("accept");
        expect(frames.some((f) => f.description.toLowerCase().includes("commitment"))).toBe(true);
        expect(frames.some((f) => f.description.toLowerCase().includes("challenge"))).toBe(true);
        expect(frames.some((f) => f.description.toLowerCase().includes("response"))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
