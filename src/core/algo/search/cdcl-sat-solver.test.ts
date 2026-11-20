import { describe, expect, it } from "vitest";
import module from "./cdcl-sat-solver";

type CNF = { clauses: number[][]; variables: number };

function solve(cnf: CNF): string {
    const frames = [...module.run(cnf)];
    return frames[frames.length - 1]!.meta.verdict as string;
}

function modelFrom(cnf: CNF): number[] | null {
    const frames = [...module.run(cnf)];
    const last = frames[frames.length - 1]!;
    if (last.meta.verdict !== "SAT") return null;
    return last.meta.model as number[];
}

/** Exhaustive reference over all 2^n assignments. */
function bruteForce(cnf: CNF): boolean {
    for (let mask = 0; mask < 1 << cnf.variables; mask += 1) {
        let ok = true;
        for (const clause of cnf.clauses) {
            let satisfied = false;
            for (const lit of clause) {
                const value = (mask >> (Math.abs(lit) - 1)) & 1 ? true : false;
                if (value === (lit > 0)) {
                    satisfied = true;
                    break;
                }
            }
            if (!satisfied) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}

function modelSatisfies(cnf: CNF, model: number[]): boolean {
    const trueVars = new Set(model.filter((l) => l > 0));
    return cnf.clauses.every((clause) => clause.some((lit) => (lit > 0 ? trueVars.has(lit) : !trueVars.has(-lit))));
}

describe("cdcl-sat-solver", () => {
    it("agrees with exhaustive enumeration on random CNFs (brute force)", () => {
        let seed = 20261119;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 180; t += 1) {
            const n = 1 + (rand() % 5);
            const m = 1 + (rand() % 9);
            const clauses: number[][] = [];
            for (let c = 0; c < m; c += 1) {
                const len = rand() % 4; // 0..3, includes empty clauses
                const clause: number[] = [];
                for (let k = 0; k < len; k += 1) {
                    const v = 1 + (rand() % n);
                    clause.push((rand() & 1) ? v : -v);
                }
                clauses.push(clause);
            }
            const cnf = { clauses, variables: n };
            const expected = bruteForce(cnf);
            const verdict = solve(cnf);
            expect(verdict, JSON.stringify(cnf)).toBe(expected ? "SAT" : "UNSAT");
            if (expected) {
                const model = modelFrom(cnf);
                expect(model).not.toBeNull();
                expect(modelSatisfies(cnf, model as number[])).toBe(true);
            }
        }
    });

    it("handles a known unsatisfiable and a known satisfiable formula", () => {
        const unsat = { clauses: [[1, 2], [-1, 2], [1, -2], [-1, -2]], variables: 2 };
        expect(solve(unsat)).toBe("UNSAT");
        const sat = { clauses: [[1, 2], [-1, 3]], variables: 3 };
        expect(solve(sat)).toBe("SAT");
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        const maxLine = module.pseudocode!.length - 1;
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.edges).toEqual([]);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThanOrEqual(maxLine);
            expect(frame.layout).toBe("array");
            expect(frame.meta).toHaveProperty("decisions");
            expect(frame.meta).toHaveProperty("conflicts");
            expect(frame.meta).toHaveProperty("learned");
        });
        expect(frames[frames.length - 1]!.meta.verdict).toBe("SAT");
    });
});
