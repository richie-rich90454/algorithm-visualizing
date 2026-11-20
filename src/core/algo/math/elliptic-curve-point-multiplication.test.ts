/**
 * elliptic-curve-point-multiplication.test.ts - Brute-force correctness,
 * frame-shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./elliptic-curve-point-multiplication";
import type { VisualFrame } from "@/types";

const P = 17;
const A = 2;
const B = 2;
const BASE = { x: 5, y: 1 };

type Pt = { x: number; y: number } | null;

function modP(value: number): number {
    return ((value % P) + P) % P;
}

function inverse(value: number): number {
    const reduced = modP(value);
    for (let i = 1; i < P; i += 1) {
        if ((reduced * i) % P === 1) {
            return i;
        }
    }
    return 0;
}

/** Independent chord-and-tangent implementation used only by the reference. */
function add(left: Pt, right: Pt): Pt {
    if (left === null) {
        return right;
    }
    if (right === null) {
        return left;
    }
    if (left.x === right.x && modP(left.y + right.y) === 0) {
        return null;
    }
    let slope: number;
    if (left.x === right.x && left.y === right.y) {
        const denominator = modP(2 * left.y);
        if (denominator === 0) {
            return null;
        }
        slope = modP((3 * left.x * left.x + A) * inverse(denominator));
    } else {
        const denominator = modP(right.x - left.x);
        if (denominator === 0) {
            return null;
        }
        slope = modP((right.y - left.y) * inverse(denominator));
    }
    const rx = modP(slope * slope - left.x - right.x);
    const ry = modP(slope * (left.x - rx) - left.y);
    return { x: rx, y: ry };
}

/** Brute-force k*BASE by repeatedly adding BASE k times. */
function bruteScalar(k: number): Pt {
    let result: Pt = null;
    for (let i = 0; i < k; i += 1) {
        result = add(result, BASE);
    }
    return result;
}

function onCurve(point: Pt): boolean {
    if (point === null) {
        return true;
    }
    return modP(point.y * point.y) === modP(point.x * point.x * point.x + A * point.x + B);
}

function finalMeta(frames: VisualFrame[]) {
    return frames[frames.length - 1]?.meta;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Elliptic Curve Point Multiplication", () => {
    it("matches a brute-force repeated-addition reference for scalars 0 through 40", () => {
        for (let k = 0; k <= 40; k += 1) {
            const frames = [...mod.run({ k, px: BASE.x, py: BASE.y })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            const expected = bruteScalar(k);
            expect(meta?.["infinity"]).toBe(expected === null);
            expect(meta?.["resultX"]).toBe(expected?.x ?? -1);
            expect(meta?.["resultY"]).toBe(expected?.y ?? -1);
        }
    });

    it("satisfies known small multiples of the base point", () => {
        const known: Array<[number, Pt]> = [
            [1, { x: 5, y: 1 }],
            [2, { x: 6, y: 3 }],
            [3, { x: 10, y: 6 }],
            [13, { x: 16, y: 4 }],
        ];
        for (const [k, expected] of known) {
            const meta = finalMeta([...mod.run({ k })]);
            expect(meta?.["resultX"]).toBe(expected?.x ?? -1);
            expect(meta?.["resultY"]).toBe(expected?.y ?? -1);
            expect(onCurve(expected)).toBe(true);
        }
    });

    it("obeys the scalar additivity property (a+b)P = aP + bP", () => {
        for (let a = 1; a <= 8; a += 1) {
            for (let b = 1; b <= 8; b += 1) {
                const left = bruteScalar(a + b);
                const ap = bruteScalar(a);
                const bp = bruteScalar(b);
                expect(add(ap, bp)).toEqual(left);
            }
        }
    });

    it("reports a non-curve base point honestly", () => {
        const frames = [...mod.run({ k: 5, px: 1, py: 1 })];
        checkFrames(frames);
        expect(finalMeta(frames)?.["valid"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
