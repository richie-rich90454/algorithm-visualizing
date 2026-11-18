/** xmss.test.ts - Chain composition, Merkle verification, tamper detection, frames. */

import { describe, expect, it } from "vitest";
import mod, { buildToyXmss, chain, combine, toyHash, verifyToyXmss } from "./xmss";
import type { VisualFrame } from "@/types";

interface Input {
    message: number;
    leafIndex: number;
    w: number;
    digits: number;
    leaves: number;
}

/** Independent reconstruction of the toy XMSS root from a signature. */
function independentRoot(input: Input): { root: number; recovered: number; digits: number[]; secret: number[] } {
    const h = (x: number): number => ((Math.imul(x >>> 0, 1103515245) + 12345) >>> 0) % 2147483647;
    const ch = (s: number, steps: number): number => {
        let v = s >>> 0;
        for (let i = 0; i < steps; i += 1) v = h(v);
        return v;
    };
    const cb = (a: number, b: number): number => h((Math.imul(a >>> 0, 31) + (b >>> 0)) >>> 0);
    const { w, digits, leaves, leafIndex, message } = input;
    const leafOf = (pk: number[]): number => pk.reduce((acc, v) => cb(acc, v), 0);
    const leavesValues: number[] = [];
    for (let l = 0; l < leaves; l += 1) {
        const pk = Array.from({ length: digits }, (_, d) => ch(h(1000 + l * 100 + d), w - 1));
        leavesValues.push(leafOf(pk));
    }
    let level = leavesValues;
    while (level.length > 1) {
        const parent: number[] = [];
        for (let i = 0; i < level.length; i += 2) parent.push(cb(level[i] ?? 0, level[i + 1] ?? 0));
        level = parent;
    }
    const root = level[0] ?? 0;

    const secret = Array.from({ length: digits }, (_, d) => h(1000 + leafIndex * 100 + d));
    const msgDigits: number[] = [];
    let rem = message % Math.pow(w, digits);
    for (let d = 0; d < digits; d += 1) {
        msgDigits.push(rem % w);
        rem = Math.floor(rem / w);
    }
    const sig = secret.map((s, d) => ch(s, msgDigits[d] ?? 0));
    const recoveredPk = sig.map((s, d) => ch(s, w - 1 - (msgDigits[d] ?? 0)));
    let node = leafOf(recoveredPk);
    const path: number[] = [];
    let cursor = leafIndex;
    let treeLevel = leavesValues;
    while (treeLevel.length > 1) {
        const sibling = cursor % 2 === 0 ? cursor + 1 : cursor - 1;
        path.push(treeLevel[sibling] ?? 0);
        const parent: number[] = [];
        for (let i = 0; i < treeLevel.length; i += 2) parent.push(cb(treeLevel[i] ?? 0, treeLevel[i + 1] ?? 0));
        treeLevel = parent;
        cursor = Math.floor(cursor / 2);
    }
    let position = leafIndex;
    for (const sib of path) {
        node = position % 2 === 0 ? cb(node, sib) : cb(sib, node);
        position = Math.floor(position / 2);
    }
    return { root, recovered: node, digits: msgDigits, secret };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("XMSS toy model", () => {
    it("reconstructs the independently built Merkle root", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, 10);
        const data = buildToyXmss(input.message, input.leafIndex, input.w, input.digits, input.leaves);
        const expected = independentRoot(input);
        expect(data.root).toBe(expected.root);
        expect(data.recoveredRoot).toBe(expected.recovered);
        expect(data.digits).toEqual(expected.digits);
        expect(data.secret).toEqual(expected.secret);
        expect(data.verified).toBe(true);
        expect(frames[frames.length - 1]?.meta["verified"]).toBe(true);
    });

    it("chain composition and public-key relation hold", () => {
        const secret = toyHash(42);
        expect(chain(secret, 5)).toBe(chain(chain(secret, 2), 3));
        const data = buildToyXmss(3, 1, 4, 2, 4);
        data.publicKey.forEach((pk, i) => {
            expect(pk).toBe(chain(data.secret[i] ?? 0, data.w - 1));
        });
        expect(combine(1, 2)).toBe(toyHash((Math.imul(1, 31) + 2) >>> 0));
    });

    it("rejects a different message and verifies every leaf index", () => {
        const input = mod.defaultInput as Input;
        const good = buildToyXmss(input.message, input.leafIndex, input.w, input.digits, input.leaves);
        expect(verifyToyXmss(good.signature, input.message, input.w, input.digits, input.leaves, input.leafIndex, good.root)).toBe(true);
        expect(verifyToyXmss(good.signature, input.message + 1, input.w, input.digits, input.leaves, input.leafIndex, good.root)).toBe(false);
        for (let leaf = 0; leaf < input.leaves; leaf += 1) {
            const result = buildToyXmss(input.message, leaf, input.w, input.digits, input.leaves);
            expect(result.verified).toBe(true);
            expect(verifyToyXmss(result.signature, input.message, input.w, input.digits, input.leaves, leaf, result.root)).toBe(true);
        }
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
