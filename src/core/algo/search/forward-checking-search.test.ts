import { describe, expect, it } from "vitest";
import mod from "./forward-checking-search";

interface Constraint {
    a: string;
    b: string;
    allowed: Array<[number, number]>;
}
interface Input {
    variables: string[];
    domains: Record<string, number[]>;
    constraints: Constraint[];
}

/** Independent brute-force satisfiability check over the full search space. */
function bruteSat(input: Input): boolean {
    const assignment: Record<string, number> = {};
    let found = false;
    const check = (): boolean => {
        for (const c of input.constraints) {
            const av = assignment[c.a];
            const bv = assignment[c.b];
            if (av === undefined || bv === undefined) continue;
            if (!c.allowed.some(([x, y]) => x === av && y === bv)) return false;
        }
        return true;
    };
    const rec = (i: number): void => {
        if (found) return;
        if (i === input.variables.length) {
            if (check()) found = true;
            return;
        }
        const v = input.variables[i]!;
        for (const value of input.domains[v] ?? []) {
            assignment[v] = value;
            rec(i + 1);
            delete assignment[v];
        }
    };
    rec(0);
    return found;
}

function frames(input: unknown) {
    return [...mod.run(input)];
}

function randomInput(seed: number): Input {
    // Deterministic pseudo-random generator so failures are reproducible.
    let s = seed * 2654435761 + 12345;
    const rnd = (): number => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
    const n = 2 + Math.floor(rnd() * 3); // 2..4 variables
    const variables = Array.from({ length: n }, (_, i) => `V${i}`);
    const domainSize = 2 + Math.floor(rnd() * 2); // 2..3 values
    const domains: Record<string, number[]> = {};
    for (const v of variables) {
        domains[v] = Array.from({ length: domainSize }, (_, i) => i + 1);
    }
    const constraints: Constraint[] = [];
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) pairs.push([i, j]);
    }
    for (const [i, j] of pairs) {
        if (rnd() < 0.6) {
            const allowed: Array<[number, number]> = [];
            for (let x = 1; x <= domainSize; x += 1) {
                for (let y = 1; y <= domainSize; y += 1) {
                    if (rnd() < 0.55) allowed.push([x, y]);
                }
            }
            constraints.push({ a: variables[i]!, b: variables[j]!, allowed });
        }
    }
    return { variables, domains, constraints };
}

describe("Forward Checking Search", () => {
    it("matches brute-force satisfiability on many random CSPs", () => {
        for (let seed = 1; seed <= 120; seed += 1) {
            const input = randomInput(seed);
            const all = frames(input);
            const last = all[all.length - 1]!;
            const moduleSat = last.meta["sat"] === true;
            const expected = bruteSat(input);
            expect(moduleSat, `seed ${seed}`).toBe(expected);

            if (moduleSat) {
                const solution = JSON.parse(String(last.meta["solution"])) as Record<string, number>;
                for (const c of input.constraints) {
                    const av = solution[c.a];
                    const bv = solution[c.b];
                    if (av === undefined || bv === undefined) continue;
                    expect(
                        c.allowed.some(([x, y]) => x === av && y === bv),
                        `solution violates a constraint for seed ${seed}`,
                    ).toBe(true);
                }
            }
        }
    });

    it("detects a known unsatisfiable instance", () => {
        const input: Input = {
            variables: ["X", "Y"],
            domains: { X: [1], Y: [1] },
            constraints: [{ a: "X", b: "Y", allowed: [[1, 2], [2, 1]] }],
        };
        const all = frames(input);
        expect(all[all.length - 1]!.meta["sat"]).toBe(false);
    });

    it("produces well-formed frames and terminates", () => {
        const all = frames(mod.defaultInput);
        expect(all.length).toBeGreaterThan(2);
        all.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            expect(f.layout).toBe("grid");
            expect(f.description.length).toBeGreaterThanOrEqual(10);
            expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(f.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(f.meta).toBeDefined();
            expect(f.entities.length).toBeGreaterThan(0);
            for (const e of f.entities) {
                expect(e.id).toBeTruthy();
                expect(typeof e.label).toBe("string");
                expect(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]).toContain(e.state);
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
                expect(typeof e.metadata).toBe("object");
            }
        });
        expect(all[all.length - 1]!.meta["sat"]).toBe(true);
    });
});
