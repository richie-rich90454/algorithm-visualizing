import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import ac4 from "./ac4-arc-consistency";

interface Constraint { a: string; b: string; pairs: Array<[number, number]> }
const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function referenceAc3(domains: Record<string, number[]>, constraints: Constraint[]): Record<string, number[]> {
    const dom: Record<string, number[]> = {};
    for (const [v, vals] of Object.entries(domains)) dom[v] = [...vals];
    const allowed = new Map<string, Set<string>>();
    const arcs: Array<[string, string]> = [];
    for (const c of constraints) {
        const forward = new Set<string>();
        const backward = new Set<string>();
        for (const [x, y] of c.pairs) {
            forward.add(`${x}|${y}`);
            backward.add(`${y}|${x}`);
        }
        allowed.set(`${c.a}|${c.b}`, forward);
        allowed.set(`${c.b}|${c.a}`, backward);
        arcs.push([c.a, c.b], [c.b, c.a]);
    }
    const queue: Array<[string, string]> = [...arcs];
    while (queue.length > 0) {
        const [x, y] = queue.shift() as [string, string];
        const pairSet = allowed.get(`${x}|${y}`);
        if (!pairSet) continue;
        const revised = (dom[x] ?? []).filter((a) => (dom[y] ?? []).some((b) => pairSet.has(`${a}|${b}`)));
        if (revised.length !== (dom[x] ?? []).length) {
            dom[x] = revised;
            for (const [p, q] of arcs) {
                if (q === x && p !== y) queue.push([p, x]);
            }
        }
    }
    return dom;
}

function finalDomains(frames: VisualFrame[]): Record<string, number[]> {
    const last = frames[frames.length - 1]!;
    const dom: Record<string, number[]> = {};
    for (const cell of last.entities) {
        const variable = String(cell.metadata.variable);
        const value = Number(cell.metadata.value);
        if (cell.state !== "error") {
            (dom[variable] ??= []).push(value);
        } else {
            dom[variable] ??= [];
        }
    }
    return dom;
}

describe("AC4ArcConsistency", () => {
    it("yields well-formed grid frames and terminates", () => {
        let index = 0;
        const frames: VisualFrame[] = [];
        for (const frame of ac4.run(ac4.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(ac4.pseudocode!.length);
            expect(frame.layout).toBe("grid");
            expect(frame.meta.rows).toBe(3);
            for (const entity of frame.entities) {
                expect(entity.type).toBe("cell");
                expect(VALID.has(entity.state)).toBe(true);
            }
            index += 1;
            frames.push(frame);
        }
        expect(frames.length).toBeGreaterThan(0);
    });

    it("matches an independent AC-3 implementation on random networks", () => {
        let seed = 11;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const vars = ["A", "B", "C", "D"];
            const domains: Record<string, number[]> = {};
            for (const v of vars) domains[v] = [1, 2, 3, 4];
            const constraints: Constraint[] = [];
            for (let e = 0; e < 4; e += 1) {
                const a = vars[rand() % vars.length]!;
                let b = vars[rand() % vars.length]!;
                if (a === b) b = vars[(vars.indexOf(a) + 1) % vars.length]!;
                const pairs: Array<[number, number]> = [];
                for (const x of [1, 2, 3, 4]) {
                    for (const y of [1, 2, 3, 4]) {
                        if (rand() % 3 !== 0) pairs.push([x, y]);
                    }
                }
                constraints.push({ a, b, pairs });
            }
            const frames: VisualFrame[] = [];
            for (const frame of ac4.run({ domains, constraints })) frames.push(frame);
            expect(finalDomains(frames)).toEqual(referenceAc3(domains, constraints));
        }
    });
});
