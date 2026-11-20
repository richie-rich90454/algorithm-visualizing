/** ecpp-primality-proof.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./ecpp-primality-proof";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function egcd(a: number, b: number): { g: number; x: number; y: number } {
    if (b === 0) return { g: a, x: 1, y: 0 };
    const t = egcd(b, a % b);
    return { g: t.g, x: t.y, y: t.x - Math.trunc(a / b) * t.y };
}
function inv(a: number, m: number): number {
    const r = egcd(((a % m) + m) % m, m);
    return r.g === 1 ? ((r.x % m) + m) % m : NaN;
}
type Point = [number, number] | null;
function add(P: Point, Q: Point, a: number, m: number): Point {
    if (P === null) return Q;
    if (Q === null) return P;
    const [x1, y1] = P;
    const [x2, y2] = Q;
    if (x1 === x2 && ((y1 + y2) % m + m) % m === 0) return null;
    let lam: number;
    if (x1 === x2 && y1 === y2) lam = ((3 * x1 * x1 + a) * inv(2 * y1, m)) % m;
    else lam = (((y2 - y1 + m) % m) * inv((x2 - x1 + m) % m, m)) % m;
    const x3 = ((lam * lam - x1 - x2) % m + m) % m;
    const y3 = ((lam * (x1 - x3) - y1) % m + m) % m;
    return [x3, y3];
}
function mul(k: number, P: Point, a: number, m: number): Point {
    let r: Point = null;
    let q = P;
    let e = k;
    while (e > 0) {
        if (e % 2) r = add(r, q, a, m);
        q = add(q, q, a, m);
        e = Math.floor(e / 2);
    }
    return r;
}
function powM(a: number, e: number, m: number): number {
    let r = 1;
    let b = ((a % m) + m) % m;
    let x = e;
    while (x > 0) {
        if (x % 2) r = (r * b) % m;
        b = (b * b) % m;
        x = Math.floor(x / 2);
    }
    return r;
}
function isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}
function isMonicPrime(q: number): boolean {
    return isPrime(q);
}

describe("ECPP primality proof", () => {
    it("certifies primes with independently verified curve certificates", () => {
        const primes = [5, 7, 11, 13, 17, 19, 23, 29, 31, 41, 53, 71, 101, 211, 1009];
        for (const n of primes) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["verdict"]).toBe("prime");
            const certificate = final?.["certificate"] as string[];
            if (n < 50) {
                expect(certificate.length).toBe(0);
                continue;
            }
            expect(certificate.length).toBeGreaterThan(0);
            for (const entry of certificate) {
                const [nStr, curve] = entry.split(":");
                const levelN = Number(nStr);
                const [a, b, order, q] = curve!.split(",").map(Number);
                expect(isMonicPrime(q!)).toBe(true);
                const bound = Math.pow(Math.pow(levelN, 0.25) + 1, 2);
                expect(q!).toBeGreaterThan(bound);
                // Independently count the group order.
                let count = 1;
                for (let x = 0; x < levelN; x += 1) {
                    const rhs = ((x * x * x + a! * x + b!) % levelN + levelN) % levelN;
                    if (rhs === 0) count += 1;
                    else if (powM(rhs, (levelN - 1) / 2, levelN) === 1) count += 2;
                }
                expect(count).toBe(order);
                // Recover the point from the frame carrying this level and verify order q.
                const levelFrame = frames.find((frame) => frame.meta["n"] === levelN && frame.meta["q"] === q);
                const point = levelFrame?.meta["point"] as number[] | undefined;
                expect(point).toBeDefined();
                expect(mul(q!, [point![0]!, point![1]!], a!, levelN)).toBe(null);
                expect(mul(Math.floor(order! / q!), [point![0]!, point![1]!], a!, levelN)).not.toBe(null);
            }
        }
    });

    it("rejects composite inputs", () => {
        for (const n of [4, 9, 25, 49, 91, 143, 1001]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["verdict"]).toBe("composite");
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
