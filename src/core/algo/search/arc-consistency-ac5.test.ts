/**
 * arc-consistency-ac5.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./arc-consistency-ac5";
import type { VisualFrame } from "@/types";

interface Constraint {
    a: string;
    b: string;
    pairs: number[][];
}
interface Input {
    domains: Record<string, number[]>;
    constraints: Constraint[];
}

function relation(constraints: Constraint[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const c of constraints) {
        for (const pair of c.pairs) {
            const forward = map.get(`${c.a}->${c.b}`) ?? new Set<string>();
            const backward = map.get(`${c.b}->${c.a}`) ?? new Set<string>();
            forward.add(`${pair[0]},${pair[1]}`);
            backward.add(`${pair[1]},${pair[0]}`);
            map.set(`${c.a}->${c.b}`, forward);
            map.set(`${c.b}->${c.a}`, backward);
        }
    }
    return map;
}

/** Independent AC-3 reference: revise arcs until a full pass makes no change. */
function ac3(input: Input): Map<string, Set<number>> {
    const domains = new Map<string, Set<number>>();
    for (const [variable, values] of Object.entries(input.domains)) {
        domains.set(variable, new Set(values));
    }
    const rel = relation(input.constraints);
    const neighbors = new Map<string, Set<string>>();
    for (const variable of domains.keys()) neighbors.set(variable, new Set<string>());
    for (const c of input.constraints) {
        neighbors.get(c.a)?.add(c.b);
        neighbors.get(c.b)?.add(c.a);
    }
    const arcs: Array<[string, string]> = [];
    for (const c of input.constraints) {
        arcs.push([c.a, c.b], [c.b, c.a]);
    }
    while (arcs.length > 0) {
        const [xi, xj] = arcs.shift() as [string, string];
        const allowed = rel.get(`${xi}->${xj}`) ?? new Set<string>();
        let changed = false;
        for (const value of [...(domains.get(xi) as Set<number>)]) {
            const supported = [...(domains.get(xj) as Set<number>)].some((other) => allowed.has(`${value},${other}`));
            if (!supported) {
                (domains.get(xi) as Set<number>).delete(value);
                changed = true;
            }
        }
        if (changed) {
            for (const xk of neighbors.get(xi) as Set<string>) {
                if (xk !== xj) arcs.push([xk, xi]);
            }
        }
    }
    return domains;
}

function checkFrames(frames: VisualFrame[], variables: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["variables"]).toBe(variables);
    });
}

function finalDomains(input: Input): Map<string, Set<number>> {
    const frames = [...mod.run(input)];
    checkFrames(frames, Object.keys(input.domains).length);
    const result = new Map<string, Set<number>>();
    for (const variable of Object.keys(input.domains)) result.set(variable, new Set<number>());
    for (const entity of frames[frames.length - 1]?.entities ?? []) {
        if (entity.state !== "error") {
            const variable = entity.metadata["variable"] as string;
            result.get(variable)?.add(entity.metadata["value"] as number);
        }
    }
    return result;
}

describe("AC-5 Arc Consistency", () => {
    it("matches AC-3 on the default network", () => {
        const input = mod.defaultInput as Input;
        const got = finalDomains(input);
        const want = ac3(input);
        for (const variable of Object.keys(input.domains)) {
            expect([...(got.get(variable) as Set<number>)].sort((a, b) => a - b)).toEqual(
                [...(want.get(variable) as Set<number>)].sort((a, b) => a - b),
            );
        }
    });

    it("matches AC-3 on several constraint networks", () => {
        const cases: Input[] = [
            {
                domains: { X: [1, 2, 3], Y: [1, 2, 3] },
                constraints: [{ a: "X", b: "Y", pairs: [[1, 1], [2, 2]] }],
            },
            {
                domains: { X: [1, 2], Y: [2, 3], Z: [3, 4] },
                constraints: [
                    { a: "X", b: "Y", pairs: [[1, 2], [2, 3]] },
                    { a: "Y", b: "Z", pairs: [[2, 3], [3, 4]] },
                    { a: "X", b: "Z", pairs: [[1, 4]] },
                ],
            },
            {
                domains: { A: [1], B: [2], C: [3] },
                constraints: [{ a: "A", b: "B", pairs: [[1, 9]] }],
            },
            {
                domains: { A: [1, 2], B: [] },
                constraints: [{ a: "A", b: "B", pairs: [[1, 1], [2, 2]] }],
            },
        ];
        for (const input of cases) {
            const got = finalDomains(input);
            const want = ac3(input);
            for (const variable of Object.keys(input.domains)) {
                expect([...(got.get(variable) as Set<number>)].sort((a, b) => a - b)).toEqual(
                    [...(want.get(variable) as Set<number>)].sort((a, b) => a - b),
                );
            }
        }
    });

    it("only removes unsupported values", () => {
        const input = mod.defaultInput as Input;
        const got = finalDomains(input);
        const rel = relation(input.constraints);
        for (const c of input.constraints) {
            for (const a of got.get(c.a) as Set<number>) {
                const supported = [...(got.get(c.b) as Set<number>)].some((b) => rel.get(`${c.a}->${c.b}`)?.has(`${a},${b}`));
                expect(supported).toBe(true);
            }
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
