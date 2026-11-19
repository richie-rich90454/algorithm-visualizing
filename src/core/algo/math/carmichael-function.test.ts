import { describe, expect, it } from "vitest";
import mod from "./carmichael-function";
import type { VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function lcm(a: number, b: number): number {
    return (a / gcd(a, b)) * b;
}

function bruteLambda(n: number): number {
    if (n === 1) {
        return 1;
    }
    let exponent = 1;
    for (let a = 1; a < n; a += 1) {
        if (gcd(a, n) !== 1) {
            continue;
        }
        let value = 1;
        let order = 0;
        do {
            value = (value * a) % n;
            order += 1;
        } while (value !== 1 && order <= n);
        exponent = lcm(exponent, order);
    }
    return exponent;
}

function bruteTotient(n: number): number {
    let count = 0;
    for (let a = 1; a <= n; a += 1) {
        if (gcd(a, n) === 1) {
            count += 1;
        }
    }
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Carmichael Function", () => {
    it("matches brute-force group exponents for n from 1 to 120", () => {
        for (let n = 1; n <= 120; n += 1) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const last = frames[frames.length - 1];
            expect(Number(last?.meta["result"])).toBe(bruteLambda(n));
            expect(Number(last?.meta["dividesTotient"] ? 1 : 0)).toBe(bruteTotient(n) % bruteLambda(n) === 0 ? 1 : 0);
        }
    });

    it("gives lambda(561) = 80, smaller than phi(561) = 320", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        expect(Number(last?.meta["result"])).toBe(80);
        expect(Number(last?.meta["phi"])).toBe(320);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
