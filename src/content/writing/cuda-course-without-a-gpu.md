---
title: You can finish a CUDA course without a GPU — if the course is designed for it
description: What “no GPU required” actually covers in cuda-cpp-course, what each of the four browser labs deliberately cuts, how simulation numbers are checked, and the exact handoff to a real card and Nsight.
date: 2026-09-11
tags: [cuda, teaching, systems, design]
draft: false
---

Most CUDA tutorials fail the same way: they teach launch syntax, hand you a vector-add, and leave you staring at a machine you don’t have. The hardware barrier is real — no NVIDIA card, driver fights, Colab quotas, cloud bills, “it compiles but I can’t run it.” So people either quit, or they rent a GPU before they know what they would measure on it.

I built [CUDA C++ Course](https://lr00rl.github.io/cuda-cpp-course/) around a different claim: **you can finish the conceptual path without a local GPU**, and the course should say exactly where that path ends. The live site is English by default with Chinese at `/zh/`. The source is public: [github.com/lr00rl/cuda-cpp-course](https://github.com/lr00rl/cuda-cpp-course).

This essay is not a second course. It is a design argument: what “no GPU” covers, what each in-browser lab keeps and throws away, how those numbers stay honest, and what “done” means the day before you open Nsight.

## The barrier is not `__global__`

`__global__`, `threadIdx`, and `<<<>>>` take half an hour. The real bar is looking at a kernel and knowing **where it is stuck** — occupancy, coalescing, bank conflicts, a reduction that still serializes on one warp, a matmul that thrash-reads global memory.

If a course only ships “best practices” checklists, you memorize slogans. If each optimization **names the bottleneck it removes**, you start reading kernels like an engineer. That is the course stance, and it is why the first half can be honest without a card on your desk.

Renting hardware does not invert that order. An A100 will happily run a bad index expression at full speed — into the wrong memory. Cycles without a model are expensive noise.

## Dual track, on purpose

The course is two products in one repo:

1. **Interactive site** — fifteen lessons in five stages, plus four labs that simulate pieces of the GPU execution model in the browser. You can complete this track without owning an NVIDIA GPU.
2. **`cuda/` directory** — nine compilable samples with timing, checks, and multi-version comparisons. On a machine with a GPU, `make` builds them. Some index logic can be replayed on CPU via `make verify` without nvcc.

That split is the design. The browser track teaches *models*. The `cuda/` track teaches *measurement*. Confusing them is how “no GPU required” turns into a lie — or how “you must rent a GPU on day one” turns into an expensive distraction.

A useful mental picture:

| Phase | Question it answers | Needs a GPU? |
| --- | --- | --- |
| Lessons + labs | What mechanism am I looking at? | No |
| `make verify` (where offered) | Did my index / tile math stay consistent? | No |
| Colab / cloud T4 | Can this kernel launch and check out on a real device? | Cloud, not local |
| Local / rented card + Nsight | What is *this* chip waiting on? | Yes |

## What “finish without a GPU” actually means

It means you can walk the conceptual ladder:

| Stage | Focus |
| --- | --- |
| 1 · Getting started | First kernel, thread hierarchy, memory management, errors |
| 2 · Execution model and memory | Warps/SMs, hierarchy, arithmetic intensity, coalescing, shared memory and banks |
| 3 · Optimization in practice | Reduction in seven steps, occupancy tradeoffs, streams and Graphs |
| 4 · Going lower | Warp primitives, reading PTX/SASS |
| 5 · Production and AI | Profiling methodology, custom ops, Tensor Cores / Triton |

Progress lives in `localStorage`. Lessons have goals, copyable code, diagrams, and self-checks. Syntax highlighting is custom because stock highlighters do not treat CUDA as first-class — and `__global__` / `threadIdx` / `<<<>>>` are exactly the tokens you need to *see*.

What it does **not** mean: that a browser model replaces a profiler, or that simulated transaction counts are your production bandwidth. When the course says you can finish without a GPU, it means the *teaching path* is complete — not that hardware is optional forever.

Legitimate no-local-GPU paths the course already acknowledges:

- Finish the site + labs (no device).
- Use a free cloud T4 (e.g. Colab) for the `cuda/` samples when you want real launches.
- Use `make verify` where offered to replay index logic on CPU.

Cloud GPUs have their own friction — timeouts, image churn, incomplete Nsight stories. They are a bridge, not a personality. Colab is great for “does `nvcc` accept this and does the result check out?” It is a weak place to learn why your kernel is memory-bound on *your* SKU.

## Four labs: the spine of the no-GPU claim

The labs exist to turn abstractions into something you can drag. They are **frontend simulations**. They do not need a GPU. Calling them “toys” is fair only if you expect them to be profilers. They are not. Each lab **cuts** something so one mechanism becomes visible — and the course is explicit about the cut.

### 1. Thread index visualizer

**Keeps:** the mapping from `gridDim` / `blockDim` to element index, warp membership, and bounds-check rejection. Drag the launch config, click a thread, read which element it owns and whether the guard rejects it.

**Cuts:** SM scheduling, latency hiding, real occupancy, warp divergence timing.

**Why this cut:** most early “performance bugs” are index bugs wearing performance clothes. If you cannot point at a thread and say which element it owns, talk about coalescing is theater.

**What you should be able to say after:** for a given `N`, `blockDim`, and `gridDim`, which threads are idle tails, which warp a thread sits in, and why a missing bounds check writes past the end.

### 2. Memory coalescing simulator

**Keeps:** how stride and access width change the number of 32B sector transactions a warp produces, and the resulting bandwidth-efficiency story.

**Cuts:** L1/L2 behavior, DRAM timing, multi-warp interference, concurrent kernels.

**Why this cut:** coalescing is usually taught as a slogan (“make accesses contiguous”). The lab forces the arithmetic. Change stride; watch transaction count move. The course QA asserts a concrete case: stride `8` → **12.5%** efficiency. That is not a vibe. It is a checkable claim about the model the lab implements.

**What you should be able to say after:** why a warp that touches addresses with large stride burns sectors, and what “efficiency” means in *sector* terms — not “it felt faster.”

### 3. Bank conflict simulator

**Keeps:** landing patterns across 32 banks; padding vs XOR swizzle; broadcast vs a real conflict.

**Cuts:** compiler surprises, actual shared-memory throughput on a given architecture, bank conflicts mixed with irregular control flow.

**Why this cut:** bank conflicts are invisible until you have a picture of the banks. The lab is that picture. The classic teaching move — `[32][32]` vs `[32][33]` — shows a many-way conflict collapsing when padding shifts the landing pattern. Course QA asserts that drop: from **32-way** conflict to **none** for that case.

**What you should be able to say after:** which shared-memory layout collides, why padding or swizzle changes the bank map, and when a “broadcast” is not a conflict.

### 4. Occupancy calculator

**Keeps:** theoretical occupancy across six architectures; whether **registers**, **shared memory**, or **thread count** is the limiter. The allocation rules match the CUDA Occupancy Calculator: registers at warp granularity, shared memory aligned to the allocation unit. Hardware limit numbers track the Programming Guide’s compute-capability appendix — order-of-magnitude honest, not marketing slides.

**Cuts:** achieved occupancy, cache thrashing, CPU-side launch overhead, PCIe effects.

**Why this cut:** occupancy is a *ceiling* story, not a scoreboard. Beginners treat “100% occupancy” as a grade. The lab’s job is to show which resource is the ceiling — and that raising occupancy can hurt if you trade away registers you needed for ILP.

**What you should be able to say after:** for a given block size and resource footprint, which knob is binding, and why “just launch more threads” is not a strategy.

### How the simulations stay honest

Playwright drives quiz UI, progress, all four labs, and mobile overflow. It also asserts lab numbers (bank-conflict padding case; coalescing stride efficiency). That matters for a public “no GPU” claim: if the model can drift, the claim becomes marketing. Automated checks are part of the teaching contract, not CI decoration.

## Where the simulator ends (and you must get a card)

You still need a real GPU when the question becomes empirical:

- What does **Nsight** say *this* kernel is waiting on — memory, stall reasons, achieved occupancy vs theoretical?
- Does this reduction still rely on pre-Volta “implicit warp synchronous” habits? (The course refuses that pattern and uses masked `__shfl_*_sync`.)
- What is the actual bandwidth of *this* tiled matmul on *this* chip, with *this* tile?

A clean handoff sequence:

1. **Finish labs + stages 1–3 conceptually** until you can name bottlenecks in sentences.
2. **Run `cuda/` samples** on Colab T4 or any real device (`make` / `make run`). Confirm results check out.
3. **Dump PTX/SASS once** (`make ptx` / `make sass`) so “going lower” is not abstract.
4. **Profile one kernel you already understand** — preferably a reduction or transpose you watched fail in a lab — with Nsight Compute / Systems.
5. Only then chase Tensor Core / framework custom-op paths.

If you skip the conceptual track and jump to renting an A100 on day one, you pay for cycles you cannot interpret. If you never leave the simulator, you have models without scars. The course is explicit about the handoff; this essay is too.

### Minimal true-hardware checklist (post-course)

- [ ] Nine samples build and run on a real GPU.
- [ ] At least one sample inspected under `compute-sanitizer` / memcheck where relevant.
- [ ] One kernel compared across two versions you can explain (e.g. naive vs tiled matmul, or two reduction stages).
- [ ] One Nsight session where you predicted the bottleneck *before* opening the report.

## Answering the hard skepticism

**“Without real perf numbers, you didn’t learn CUDA.”**  
You learned the *explanatory* layer: hierarchy, memory behavior, named bottlenecks. Perf numbers are the *measurement* layer. Both are required for production work; only one requires a card. Pretending they are the same thing is how beginners drown in Nsight before they can read an index expression.

**“Just buy/rent a GPU.”**  
Do — when you know what you will measure. Hardware does not teach coalescing by itself. A weekend of labs + one focused profiling session beats a month of rented idle time.

**“Browser labs are toys.”**  
They are scoped models. Toys hide their cuts; these labs advertise them. That is the difference. A toy says “look, colorful threads.” A lab says “we deleted the cache hierarchy on purpose so you can see sectors.”

**“How is this different from another intro site?”**  
Dual track; bottleneck-named optimizations; labs with asserted numbers; Volta-safe warp primitives; bilingual site; samples that pass sanitizer / CPU verify where claimed. Judge it by those choices, not by landing-page adjectives.

**“Simulators and desktops differ too much.”**  
Yes — and the course should not blur that. Simulation teaches *which question to ask*. Hardware answers *what this silicon did*. Collapsing those into one “CUDA experience” is how people get false confidence or false despair.

## What “done” looks like (no-GPU phase)

You are done with the *no-GPU phase* when you can:

- Explain which bottleneck a given optimization removes — in a sentence, without a slide.
- Predict, before clicking, what the coalescing and bank-conflict labs will show for a chosen pattern.
- Point at a reduction and say whether it is warp-safe on Volta+.
- Write down the first kernel you will profile on real hardware and *why* — including what result would surprise you.

You are not done with CUDA. You are done pretending syntax was the course.

## Links

- Course (EN): [lr00rl.github.io/cuda-cpp-course](https://lr00rl.github.io/cuda-cpp-course/)
- Course (中文): […/zh/](https://lr00rl.github.io/cuda-cpp-course/zh/)
- Source: [github.com/lr00rl/cuda-cpp-course](https://github.com/lr00rl/cuda-cpp-course)

This page lives on the RoobLi presence site — one markdown source, deployed as the public surface. Channels get excerpts. The course repo remains the demo; this essay remains the argument.
