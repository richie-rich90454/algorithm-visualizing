/**
 * brzozowski-derivative.test.ts
 * Acceptance via repeated derivatives is cross-checked against an independent
 * brute-force language matcher that computes end positions directly from the
 * regex semantics, plus hand-worked cases and frame-shape invariants.
 */

import { describe, expect, it } from "vitest";
import mod from "./brzozowski-derivative";

type Node =
    | { t: "empty" }
    | { t: "eps" }
    | { t: "char"; c: string }
    | { t: "|" | "."; a: Node; b: Node }
    | { t: "*"; a: Node };

/** Independent parser for the same small regex grammar used by the module. */
function parse(s: string): Node {
    let i = 0;
    const alt = (): Node => {
        let r = seq();
        while (s[i] === "|") {
            i += 1;
            r = { t: "|", a: r, b: seq() };
        }
        return r;
    };
    const seq = (): Node => {
        let r: Node | null = null;
        while (i < s.length && s[i] !== "|" && s[i] !== ")") {
            const next = postfix();
            r = r === null ? next : { t: ".", a: r, b: next };
        }
        return r ?? { t: "eps" };
    };
    const postfix = (): Node => {
        let r = atom();
        while (s[i] === "*") {
            i += 1;
            r = { t: "*", a: r };
        }
        return r;
    };
    const atom = (): Node => {
        const c = s[i];
        if (c === "(") {
            i += 1;
            const inner = alt();
            if (s[i] === ")") i += 1;
            return inner;
        }
        i += 1;
        return { t: "char", c: c ?? "" };
    };
    return alt();
}

/** Brute-force set of end positions reachable after matching a regex from index i. */
function ends(node: Node, s: string, i: number): Set<number> {
    switch (node.t) {
        case "empty":
            return new Set();
        case "eps":
            return new Set([i]);
        case "char":
            return s[i] === node.c ? new Set([i + 1]) : new Set();
        case "|": {
            const out = ends(node.a, s, i);
            for (const p of ends(node.b, s, i)) out.add(p);
            return out;
        }
        case ".": {
            const out = new Set<number>();
            for (const p of ends(node.a, s, i)) for (const q of ends(node.b, s, p)) out.add(q);
            return out;
        }
        case "*": {
            const out = new Set<number>([i]);
            let frontier = new Set<number>([i]);
            while (frontier.size > 0) {
                const next = new Set<number>();
                for (const p of frontier) {
                    for (const q of ends(node.a, s, p)) {
                        if (!out.has(q)) {
                            out.add(q);
                            next.add(q);
                        }
                    }
                }
                frontier = next;
            }
            return out;
        }
    }
}

function bruteAccepts(pattern: string, input: string): boolean {
    return ends(parse(pattern), input, 0).has(input.length);
}

function finalFrame(pattern: string, input: string) {
    const frames = [...mod.run({ pattern, input })];
    return frames[frames.length - 1] as (typeof frames)[number];
}

function moduleAccepts(pattern: string, input: string): boolean {
    return finalFrame(pattern, input).meta["accepted"] as boolean;
}

function checkFrameShapes(pattern: string, input: string): void {
    const frames = [...mod.run({ pattern, input })];
    expect(frames.length).toBeGreaterThan(0);
    const pseudocodeLength = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber as number).toBeLessThan(pseudocodeLength);
        expect(frame.layout).toBe("tree");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const entity of frame.entities) {
            expect(entity.type).toBe("node");
            expect(typeof entity.metadata["parentId"]).toBe("string");
        }
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Brzozowski Derivative", () => {
    it("accepts and rejects hand-worked patterns", () => {
        const cases: Array<[string, string, boolean]> = [
            ["a", "a", true],
            ["a", "b", false],
            ["a", "", false],
            ["a*", "", true],
            ["a*", "aaa", true],
            ["a*", "b", false],
            ["ab|ac", "ab", true],
            ["ab|ac", "ac", true],
            ["ab|ac", "ad", false],
            ["(ab)*", "abab", true],
            ["(ab)*", "aba", false],
            ["(ab|ac)*", "abac", true],
            ["(ab|ac)*", "abax", false],
        ];
        for (const [pattern, input, expected] of cases) {
            expect(moduleAccepts(pattern, input), `${pattern} / ${input}`).toBe(expected);
        }
    });

    it("agrees with the independent brute-force matcher on all short strings", () => {
        const patterns = ["a", "a*", "ab", "ab|ba", "(ab)*", "a|b*", "(a|b)*", "abb", "a*b*"];
        const alphabet = ["a", "b"];
        const inputs: string[] = [""];
        let previous = [""];
        for (let length = 1; length <= 4; length += 1) {
            const current: string[] = [];
            for (const prefix of previous) for (const c of alphabet) current.push(prefix + c);
            inputs.push(...current);
            previous = current;
        }
        for (const pattern of patterns) {
            for (const input of inputs) {
                expect(moduleAccepts(pattern, input), `${pattern} / ${input}`).toBe(
                    bruteAccepts(pattern, input),
                );
            }
        }
    });

    it("produces well-formed frames and terminates", () => {
        const defaults = mod.defaultInput as { pattern: string; input: string };
        checkFrameShapes(defaults.pattern, defaults.input);
        checkFrameShapes("ab|ac", "ac");
        const frames = [...mod.run(defaults)];
        const last = frames[frames.length - 1] as (typeof frames)[number];
        expect(last.description).toContain("accepted");
        expect(last.meta["accepted"]).toBe(true);
    });
});
