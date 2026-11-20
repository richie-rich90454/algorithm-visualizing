/**
 * pratt-parser.test.ts
 * The Pratt parser's results are cross-checked against an independent
 * recursive-descent evaluator (precedence levels rather than binding powers),
 * plus hand-worked precedence cases and frame-shape invariants.
 */

import { describe, expect, it } from "vitest";
import mod from "./pratt-parser";

/** Independent classic recursive-descent evaluator with explicit precedence levels. */
function referenceEval(expr: string): number {
    const tokens = expr.match(/\d+|[+\-*/()]/g) ?? [];
    let i = 0;
    const primary = (): number => {
        const t = tokens[i];
        if (t === "-") {
            i += 1;
            return -primary();
        }
        if (t === "(") {
            i += 1;
            const value = additive();
            if (tokens[i] === ")") i += 1;
            return value;
        }
        i += 1;
        return Number(t ?? 0);
    };
    const multiplicative = (): number => {
        let value = primary();
        while (tokens[i] === "*" || tokens[i] === "/") {
            const op = tokens[i];
            i += 1;
            const right = primary();
            value = op === "*" ? value * right : right === 0 ? 0 : value / right;
        }
        return value;
    };
    const additive = (): number => {
        let value = multiplicative();
        while (tokens[i] === "+" || tokens[i] === "-") {
            const op = tokens[i];
            i += 1;
            const right = multiplicative();
            value = op === "+" ? value + right : value - right;
        }
        return value;
    };
    return additive();
}

function finalFrame(expr: string) {
    const frames = [...mod.run({ expr })];
    return frames[frames.length - 1] as (typeof frames)[number];
}

function moduleResult(expr: string): number {
    return finalFrame(expr).meta["result"] as number;
}

function checkFrameShapes(expr: string): void {
    const frames = [...mod.run({ expr })];
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

/** Deterministic random expression generator using a balanced grammar. */
let seed = 987654321;
function rand(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
}
function generate(depth: number): string {
    if (depth <= 0 || rand() < 0.3) return String(1 + Math.floor(rand() * 9));
    const left = generate(depth - 1);
    const right = generate(depth - 1);
    const op = ["+", "-", "*"][Math.floor(rand() * 3)] as string;
    return `(${left} ${op} ${right})`;
}

describe("Pratt Parser", () => {
    it("resolves precedence, associativity, parentheses, and unary minus", () => {
        const cases: Array<[string, number]> = [
            ["1 + 2 * 3 - 4", 3],
            ["2 + 3 * 4", 14],
            ["2 * 3 + 4", 10],
            ["(2 + 3) * 4", 20],
            ["10 - 2 - 3", 5],
            ["-3 + 5 * 2", 7],
            ["2 * (3 + 4) - 5", 9],
            ["8 / 2 * 3", 12],
            ["4 + 6 / 3", 6],
        ];
        for (const [expr, expected] of cases) {
            expect(moduleResult(expr), expr).toBe(expected);
        }
    });

    it("agrees with the independent evaluator on random expressions", () => {
        for (let trial = 0; trial < 80; trial += 1) {
            const expr = generate(3);
            expect(moduleResult(expr), expr).toBeCloseTo(referenceEval(expr));
        }
    });

    it("produces well-formed frames and terminates", () => {
        const defaults = mod.defaultInput as { expr: string };
        checkFrameShapes(defaults.expr);
        checkFrameShapes("(2 + 3) * 4");
        checkFrameShapes("");
        const frames = [...mod.run(defaults)];
        const last = frames[frames.length - 1] as (typeof frames)[number];
        expect(last.description).toContain("Done");
        expect(last.meta["result"]).toBe(3);
        expect(last.meta["tokens"]).toEqual(["1", "+", "2", "*", "3", "-", "4"]);
    });
});
