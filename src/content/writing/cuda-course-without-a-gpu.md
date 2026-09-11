---
title: You can finish a CUDA course without a GPU — if the course is designed for it
description: What “no GPU required” actually covers in cuda-cpp-course, what the four browser labs deliberately cut, and when you still need a real card and Nsight.
date: 2026-09-11
tags: [cuda, teaching, systems, design]
draft: false
---

Most CUDA tutorials fail the same way: they teach launch syntax, hand you a vector-add, and leave you staring at a machine you don’t have. The hardware barrier is real — no NVIDIA card, driver fights, Colab quotas, cloud bills, “it compiles but I can’t run it.” So people either quit, or they rent a GPU before they know what they would measure on it.

I built [CUDA C++ Course](https://lr00rl.github.io/cuda-cpp-course/) around a different claim: **you can finish the conceptual path without a local GPU**, and the course should say exactly where that path ends. The live site is English by default with Chinese at `/zh/`. The source is public: [github.com/lr00rl/cuda-cpp-course](https://github.com/lr00rl/cuda-cpp-course).

This essay is not a second course. It is a design note: what “no GPU” covers, what the four in-browser labs keep and throw away, and what “done” means before you touch Nsight.

## The barrier is not `__global__`

`__global__`, `threadIdx`, and `<<<>>>` take half an hour. The real bar is looking at a kernel and knowing **where it is stuck** — occupancy, coalescing, bank conflicts, a reduction that still serializes on one warp, a matmul that thrash-reads global memory.

If a course only ships “best practices” checklists, you memorize slogans. If each optimization **names the bottleneck it removes**, you start reading kernels like an engineer. That is the course stance, and it is why the first half can be honest without a card on your desk.

## Dual track, on purpose

The course is two products in one repo:

1. **Interactive site** — fifteen lessons in five stages, plus four labs that simulate pieces of the GPU execution model in the browser. You can complete this track without owning an NVIDIA GPU.
2. **`cuda/` directory** — nine compilable samples with timing, checks, and multi-version comparisons. On a machine with a GPU, `make` builds them. Some index logic can be replayed on CPU via `make verify` without nvcc.

That split is the design. The browser track teaches *models*. The `cuda/` track teaches *measurement*. Confusing them is how “no GPU required” turns into a lie — or how “you must rent a GPU on day one” turns into an expensive distraction.

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

Cloud GPUs have their own friction — timeouts, image churn, incomplete Nsight stories. They are a bridge, not a personality.

## Four labs: four public tradeoffs

The labs exist to turn abstractions into something you can drag. They are **frontend simulations**. They do not need a GPU. Calling them “toys” is fair only if you expect them to be profilers. They are not. Each lab cuts something so one mechanism becomes visible.

### 1. Thread index visualizer

**Keeps:** the mapping from `gridDim` / `blockDim` to element index, warp membership, and bounds-check rejection.  
**Cuts:** SM scheduling, latency hiding, real occupancy.  
**Why:** most early bugs are index bugs wearing performance clothes. If you cannot point at a thread and say which element it owns, optimization talk is theater.

### 2. Memory coalescing simulator

**Keeps:** how stride and access width change the number of 32B sector transactions a warp produces, and the resulting bandwidth efficiency story.  
**Cuts:** caches, DRAM timing, multi-warp interference.  
**Why:** coalescing is usually taught as a slogan. The lab forces the arithmetic: stride-8 efficiency is not a vibe, it is a number you can check (the course QA asserts 12.5% for that case).

### 3. Bank conflict simulator

**Keeps:** landing patterns across 32 banks; padding vs XOR swizzle; broadcast vs a real conflict.  
**Cuts:** compiler surprises, actual shared-memory throughput on a given architecture.  
**Why:** bank conflicts are invisible until you have a mental picture of the banks. The lab is that picture.

### 4. Occupancy calculator

**Keeps:** theoretical occupancy across six architectures; whether registers, shared memory, or thread count is the limiter.  
**Cuts:** achieved occupancy, thrashing, CPU-side launch overhead.  
**Why:** occupancy is a ceiling story, not a scoreboard. The model matches the CUDA Occupancy Calculator’s allocation rules (registers at warp granularity, shared memory aligned to the allocation unit). Hardware numbers in the course track the Programming Guide’s compute-capability appendix — order-of-magnitude honest, not marketing slides.

QA is not vibes either: Playwright drives quiz UI, progress, all four labs, and mobile overflow, and asserts lab numbers (including the classic `[32][32]` → `[32][33]` bank-conflict drop).

## Where the simulator ends

You still need a real GPU when the question becomes:

- What does **Nsight** say this kernel is waiting on?
- Does this reduction still rely on pre-Volta “implicit warp synchronous” habits? (The course refuses that pattern and uses masked `__shfl_*_sync`.)
- What is the actual bandwidth of *this* tiled matmul on *this* chip?

A minimal post-course hardware checklist:

1. Run the nine `cuda/` samples end-to-end (`make` / `make run`).
2. Dump PTX/SASS once (`make ptx` / `make sass`) so “going lower” is not abstract.
3. Profile one kernel you already understand conceptually — preferably a reduction or transpose you watched fail in a lab.
4. Only then chase Tensor Core / framework custom-op paths.

If you skip the conceptual track and jump to renting an A100 on day one, you pay for cycles you cannot interpret. If you never leave the simulator, you have models without scars. The course is explicit about the handoff; this essay is too.

## Answering the hard skepticism

**“Without real perf numbers, you didn’t learn CUDA.”**  
You learned the *explanatory* layer: hierarchy, memory behavior, named bottlenecks. Perf numbers are the *measurement* layer. Both are required for production work; only one requires a card. Pretending they are the same thing is how beginners drown in Nsight before they can read an index expression.

**“Just buy/rent a GPU.”**  
Do — when you know what you will measure. Hardware does not teach coalescing by itself.

**“Browser labs are toys.”**  
They are scoped models. Toys hide their cuts; these labs advertise them. That is the difference.

**“How is this different from another intro site?”**  
Dual track; bottleneck-named optimizations; labs with asserted numbers; Volta-safe warp primitives; bilingual site; samples that pass sanitizer / CPU verify where claimed. Judge it by those choices, not by landing-page adjectives.

## What “done” looks like

You are done with the *no-GPU phase* when you can:

- Explain which bottleneck a given optimization removes — in a sentence, without a slide.
- Predict, before clicking, what the coalescing and bank-conflict labs will show for a chosen pattern.
- Point at a reduction and say whether it is warp-safe on Volta+.
- Write down the first kernel you will profile on real hardware and *why*.

You are not done with CUDA. You are done pretending syntax was the course.

## Links

- Course (EN): [lr00rl.github.io/cuda-cpp-course](https://lr00rl.github.io/cuda-cpp-course/)
- Course (中文): […/zh/](https://lr00rl.github.io/cuda-cpp-course/zh/)
- Source: [github.com/lr00rl/cuda-cpp-course](https://github.com/lr00rl/cuda-cpp-course)

This page lives on the RoobLi presence site — one markdown source, deployed as the public surface. Channels get excerpts. The course repo remains the demo; this essay remains the argument.
