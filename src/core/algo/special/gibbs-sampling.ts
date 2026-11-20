/**
 * gibbs-sampling.ts – Gibbs Sampling.
 * Samples binary (X,Y) by alternating conditionals P(X|Y) and P(Y|X):
 * P(X=1|Y)=0.3+0.5Y, P(Y=1|X)=0.4+0.3X. Empirical marginals converge
 * to the joint's true marginals. Fixed-seed LCG keeps it deterministic.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { sweeps?: number; seed?: number } | null) ?? {};
    const sweeps = Math.max(1, Math.min(12, cfg.sweeps ?? 10));
    const rnd = lcg(cfg.seed ?? 21);
    let x = 0;
    let y = 0;
    let cx = 0;
    let step = 0;
    const frame = (t: number, desc: string): VisualFrame => {
        const vals = [x, y];
        const entities: VisualEntity[] = vals.map((v, i) => ({
            id: `v-${i}`,
            type: "cell" as const,
            label: `${i === 0 ? "X" : "Y"}=${v}`,
            value: v,
            state: (i === (t % 2 === 0 ? 1 : 0) && t > 0 ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: desc,
            codeLineNumber: Math.min(t, 6),
            layout: "grid",
            meta: { sweep: t, x, y, meanX: t > 0 ? Math.round((cx / t) * 100) / 100 : 0 },
        };
    };
    yield frame(0, "Start (X,Y)=(0,0); each sweep resamples X|Y then Y|X.");
    step += 1;
    for (let t = 1; t <= sweeps; t += 1) {
        x = rnd() < 0.3 + 0.5 * y ? 1 : 0;
        y = rnd() < 0.4 + 0.3 * x ? 1 : 0;
        cx += x;
        yield frame(
            t,
            `Sweep ${t}: drew X=${x} given Y, then Y=${y} given X (mean X ≈ ${(cx / t).toFixed(2)}).`,
        );
        step += 1;
    }
    yield frame(
        sweeps + 1,
        `Done: empirical P(X=1) ≈ ${(cx / sweeps).toFixed(2)} over ${sweeps} sweeps.`,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Gibbs sampling is a Markov chain Monte Carlo method for sampling a joint distribution when each variable is easy to sample conditionally on the others. It repeatedly resamples one variable from its full conditional distribution while holding the rest fixed. Over many sweeps, the distribution of the sampled states converges to the target joint distribution.",
        "invariants": [
            "Each draw comes from the correct conditional P(X|Y) or P(Y|X).",
            "The chain's state (X,Y) is always a valid assignment in {0,1}^2.",
            "The running mean accumulates the X values actually sampled."
        ],
        "correctness": "Alternating draws from the full conditionals defines a Markov chain whose stationary distribution is the target joint; under standard irreducibility conditions the chain converges to it. Consequently long-run averages such as the empirical P(X=1) converge to the true marginal by the ergodic theorem.",
        "complexityRationale": "Each sweep updates two binary variables with a constant-time draw, so t sweeps cost O(t). Only the current state and a single accumulator are stored, O(1) space.",
        "uses": [
            "Bayesian posterior sampling in tools such as BUGS and Stan",
            "Latent-variable and topic models like latent Dirichlet allocation",
            "Image restoration and computer vision",
            "Bioinformatics and high-dimensional Monte Carlo integration"
        ],
        "references": [
            "Geman and Geman, Stochastic Relaxation, Gibbs Distributions, and the Bayesian Restoration of Images, IEEE TPAMI, 1984",
            "Robert and Casella, Monte Carlo Statistical Methods, Chapter 10"
        ],
        "workedExample": "Start at (X,Y)=(0,0). Sweep 1 draws X with probability 0.3+0.5·0=0.3, then Y with probability 0.4+0.3·X given the new X. Repeating the alternation produces a sequence of states; the fraction of sweeps with X=1 approaches the true marginal of X implied by the two conditionals."
    },
    id: "gibbs-sampling",
    name: "Gibbs Sampling",
    category: "math",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: { sweeps: 10, seed: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize binary state (X,Y) <- (0,0)",
        "for sweep t <- 1 to sweeps",
        "resample X from conditional P(X|Y)",
        "resample Y from conditional P(Y|X)",
        "accumulate running mean of X samples",
        "track convergence of empirical marginal",
        "done: empirical P(X=1) approximates the truth",
    ],
};

export default module;
