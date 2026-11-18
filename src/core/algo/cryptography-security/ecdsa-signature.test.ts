/**
 * ecdsa-signature.test.ts - Independent curve math and verification, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./ecdsa-signature";
import type { VisualFrame } from "@/types";

const FIELD = 17;
const A = 2;
type Point = { x: number; y: number } | null;

function inv(value: number, m: number): number {
    let [oldR, r] = [((value % m) + m) % m, m];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % m) + m) % m;
}
function add(p: Point, q: Point): Point {
    if (!p) return q;
    if (!q) return p;
    if (p.x === q.x && (p.y + q.y) % FIELD === 0) return null;
    let slope = p.x === q.x
        ? ((3 * p.x * p.x + A) * inv(2 * p.y, FIELD)) % FIELD
        : ((q.y - p.y) * inv(q.x - p.x, FIELD)) % FIELD;
    slope = ((slope % FIELD) + FIELD) % FIELD;
    const x = ((slope * slope - p.x - q.x) % FIELD + FIELD) % FIELD;
    const y = ((slope * (p.x - x) - p.y) % FIELD + FIELD) % FIELD;
    return { x, y };
}
function mul(k: number, p: Point): Point {
    let result: Point = null;
    let base = p;
    let n = k;
    while (n > 0) {
        if (n % 2 === 1) result = add(result, base);
        base = add(base, base);
        n = Math.floor(n / 2);
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(12);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(4);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("EcdsaSignature", () => {
    it("computes the curve order independently", () => {
        const frames = [...mod.run({ message: "HI" })];
        checkFrames(frames);
        const g: Point = { x: 5, y: 1 };
        let n = 0;
        for (let i = 1; i <= 35; i += 1) {
            if (mul(i, g) === null) { n = i; break; }
        }
        expect(Number(frames[0]?.meta["n"])).toBe(n);
        expect(n).toBe(19);
    });

    it("verifies valid signatures and rejects forgeries", () => {
        const messages = ["", "A", "HI", "TEST", "LONGERMESSAGE", "Z".repeat(20)];
        for (const message of messages) {
            const frames = [...mod.run({ message })];
            checkFrames(frames);
            const verify = frames[2];
            const n = Number(verify?.meta["n"]);
            const z = Number(verify?.meta["z"]);
            const r = Number(verify?.meta["r"]);
            const s = Number(verify?.meta["s"]);
            const u1 = Number(verify?.meta["u1"]);
            const u2 = Number(verify?.meta["u2"]);
            const g: Point = { x: 5, y: 1 };
            const q = mul(7, g);
            const R = add(mul(u1, g), mul(u2, q));
            expect(R ? R.x % n : -1).toBe(Number(verify?.meta["rx"]));
            expect(verify?.meta["valid"]).toBe(true);
            expect(frames[3]?.meta["tamperValid"]).toBe(false);
            const nonce = Number((frames[0]?.entities ?? [])[2]?.value);
            expect((inv(s, n) * (z + r * 7)) % n).toBe(nonce % n);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
