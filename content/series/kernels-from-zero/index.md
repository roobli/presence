---
title: Kernels from zero
description: "One CUDA kernel, a matrix transpose, rewritten one idea at a time: first correct, then coalesced, then tiled, then measured."
status: in-progress
project: projects/cuda-cpp-course
start: essays/cuda-course-without-a-gpu
planned:
  - Occupancy and the tile shape
  - Measuring it for real, with Nsight Compute
tags:
  - cuda
  - performance
---

A transpose does no arithmetic. Every nanosecond it spends goes to moving bytes, so whatever it loses against a plain copy is lost to the order in which it touches memory. That makes it the cleanest kernel for watching the memory system work.

Each episode starts from the kernel the previous one left behind and changes one idea. Every version is checked against the same exact reference and reported as the same number, effective bandwidth, next to a copy kernel that moves the same bytes.

The series builds on the [[projects/cuda-cpp-course|CUDA C++ Course]]. If you have not taken it, [[essays/cuda-course-without-a-gpu|the essay on how the course works]] is the place to start.
