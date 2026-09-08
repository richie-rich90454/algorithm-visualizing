import { describe, expect, it } from "vitest";
const ids = [
    "trial-division-factorization",
    "fermat-factorization",
    "solovay-strassen-test",
    "lucas-lehmer-mersenne",
    "pohlig-hellman-discrete-log",
    "pollard-rho-discrete-log",
    "montgomery-reduction",
    "ncr-precompute-factorials",
    "karatsuba-multiplication",
    "polynomial-long-division",
    "continued-fractions-convergents",
    "stern-brocot-tree",
    "binary-gcd-stein",
    "prime-counting-meissel-lehmer",
    "segmented-sieve",
    "sieve-of-atkin",
    "primitive-root-search",
    "multiplicative-order-finding",
    "lu-decomposition",
    "modular-gaussian-elimination-mod-p",
    "elliptic-curve-point-addition",
    "shamir-secret-sharing",
    "lagrange-interpolation",
    "gray-code-generation",
    "josephus-problem",
    "divisor-sieve-sigma",
    "hensel-lifting-root",
    "pollard-p-minus-1",
    "legendre-symbol-euler-criterion",
    "jacobi-symbol",
    "wilson-theorem-prime-test",
    "inclusion-exclusion-counting",
    "linear-congruence-solver",
    "addition-chain-brauer-star",
    "lucas-sequences-lehmer",
    "sieve-of-sundaram",
    "factorial-prime-exponent-legendre",
    "integer-sqrt-newton",
    "goldbach-partitions-sieve",
    "twin-prime-sieve",
    "bertrand-postulate-check",
    "modular-tetration-tower-euler",
    "linear-diophantine-two-var",
    "hamming-code-encode-decode",
    "baillie-psw-primality",
    "carmichael-korselt-test",
    "elgamal-encryption-toy",
    "farey-sequence",
    "even-perfect-numbers-euler",
    "permutation-rank-factoradic",
];
describe("verify", () => {
    it("all modules: sequential steps, 5-15 frames, spot-check verdicts", async () => {
        const results: Record<string, unknown> = {};
        const mods = import.meta.glob<{
            default: {
                defaultInput: unknown;
                run: (
                    input: unknown,
                ) => Generator<{ stepNumber: number; entities: unknown[]; meta: unknown }>;
            };
        }>(["./*.ts", "!./*.test.ts"], { eager: true });
        for (const id of ids) {
            const mod = mods[`./${id}.ts`]!.default;
            const frames = [...mod.run(mod.defaultInput)];
            expect(frames.length).toBeGreaterThanOrEqual(5);
            expect(frames.length).toBeLessThanOrEqual(15);
            frames.forEach((f: { stepNumber: number; entities: unknown[] }, i: number) => {
                expect(f.stepNumber).toBe(i);
                expect(f.entities.length).toBeGreaterThan(0);
            });
            results[id] = frames[frames.length - 1].meta;
            if (frames.length < 5 || frames.length > 15)
                console.log(
                    "COUNT",
                    id,
                    frames.length,
                    JSON.stringify(frames.map((f) => f.stepNumber)),
                );
        }
        console.log(JSON.stringify(results, null, 0));
        expect(results["trial-division-factorization"]).toEqual({ factors: [7, 13] });
        expect(results["fermat-factorization"]).toEqual({ factors: [7, 11] });
        expect(results["solovay-strassen-test"]).toEqual({ probablyPrime: true });
        expect(results["lucas-lehmer-mersenne"]).toEqual({ prime: true });
        expect(results["pohlig-hellman-discrete-log"]).toEqual({ x: 6, ok: true });
        expect(results["pollard-rho-discrete-log"]).toEqual({ x: 7 });
        expect(results["montgomery-reduction"]).toEqual({ out: 3 });
        expect(results["ncr-precompute-factorials"]).toEqual({ ans: 10 });
        expect(results["karatsuba-multiplication"]).toEqual({ out: 408 });
        expect(results["polynomial-long-division"]).toEqual({ quot: [1, 1, 2], rem: 2 });
        expect(results["continued-fractions-convergents"]).toEqual({ p: 7, q: 5 });
        expect(results["binary-gcd-stein"]).toEqual({ gcd: 12 });
        expect(results["prime-counting-meissel-lehmer"]).toEqual({ pi: 10 });
        expect(results["segmented-sieve"]).toEqual({ count: 10 });
        expect(results["sieve-of-atkin"]).toEqual({ count: 10 });
        expect(results["primitive-root-search"]).toEqual({ root: 2 });
        expect(results["multiplicative-order-finding"]).toEqual({ ord: 10 });
        expect(results["shamir-secret-sharing"]).toEqual({ rec: 7 });
        expect(results["lagrange-interpolation"]).toEqual({ total: 13 });
        expect(results["gray-code-generation"]).toEqual({ codes: [0, 1, 3, 2, 6, 7, 5, 4] });
        expect(results["josephus-problem"]).toEqual({ survivor: 4 });
        expect(results["divisor-sieve-sigma"]).toEqual({ sigma: 28 });
        expect(results["hensel-lifting-root"]).toEqual({ r: 10, ok: true });
        expect(results["pollard-p-minus-1"]).toEqual({});
        expect(results["legendre-symbol-euler-criterion"]).toEqual({ legendre: 1, wit: 4 });
        expect(results["jacobi-symbol"]).toEqual({ jacobi: -1 });
        expect(results["wilson-theorem-prime-test"]).toEqual({ prime: true });
        expect(results["inclusion-exclusion-counting"]).toEqual({ uni: 20 });
        expect(results["linear-congruence-solver"]).toEqual({ solutions: [2, 5, 8, 11] });
        expect(results["sieve-of-sundaram"]).toEqual({ count: 10 });
        expect(results["factorial-prime-exponent-legendre"]).toEqual({ v: 6 });
        expect(results["integer-sqrt-newton"]).toEqual({ root: 7 });
        expect(results["goldbach-partitions-sieve"]).toEqual({ count: 2 });
        expect(results["twin-prime-sieve"]).toEqual({ count: 4 });
        expect(results["bertrand-postulate-check"]).toEqual({ witness: 11 });
        expect(results["modular-tetration-tower-euler"]).toEqual({ out: 1 });
        expect(results["linear-diophantine-two-var"]).toEqual({ ok: true });
        expect(results["hamming-code-encode-decode"]).toEqual({ syn: 6, fixed: true });
        expect(results["baillie-psw-primality"]).toEqual({ composite: true });
        expect(results["carmichael-korselt-test"]).toEqual({ carmichael: true });
        expect(results["elgamal-encryption-toy"]).toEqual({ dec: 5 });
        expect(results["farey-sequence"]).toEqual({ count: 7 });
        expect(results["even-perfect-numbers-euler"]).toEqual({ perf: 496, perfect: true });
        expect(results["permutation-rank-factoradic"]).toEqual({ rank: 4 });
        expect(results["stern-brocot-tree"]).toEqual({ found: true });
        expect(results["modular-gaussian-elimination-mod-p"]).toEqual({ chk: [5, 6] });
        expect(results["lucas-sequences-lehmer"]).toEqual({ U: [0, 1, 3, 8, 21] });
        expect(results["elliptic-curve-point-addition"]).toEqual({ rx: 10, ry: 6, ok: true });
        expect(results["addition-chain-brauer-star"]).toEqual({
            chain: [1, 2, 3, 6, 12, 15],
            valid: true,
        });
    });
});
