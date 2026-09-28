---
title: A kernel that is correct
description: "Before a kernel is fast it has to be right. A naive transpose, a copy kernel that sets the ceiling, a check that compares every element exactly, and the one number every later episode reports."
date: 2026-09-28
part: 1
tags:
  - cuda
  - performance
claims:
  - figure: "128 MiB"
    text: "moved by one 4096 × 4096 float transpose, every element read once and written once."
  - quote: "A transpose moves bits and never rounds, so the check is equality, not a tolerance."
  - figure: "2²⁴"
    text: "distinct floats fill a 4096 × 4096 matrix exactly, so one misplaced element fails the check."
---

The series has one rule. Each episode takes the kernel the last one left behind, changes one idea, and measures what that idea bought. This episode writes the kernel every later one is measured against, and the three things that make a measurement worth reading: a ceiling, a check and a number.

The kernel is a transpose of an `n × n` matrix of floats, stored row by row: the element in row `y`, column `x` lives at `in[y * n + x]`, and the transpose puts it at `out[x * n + y]`. Throughout the series `n` is 4096.

## The naive kernel

One thread per element, in blocks of 32 × 8 threads:

```cpp
__global__ void transpose_naive(float* out, const float* in, int n) {
  int x = blockIdx.x * blockDim.x + threadIdx.x;  // column
  int y = blockIdx.y * blockDim.y + threadIdx.y;  // row
  if (x < n && y < n) out[x * n + y] = in[y * n + x];
}

dim3 block(32, 8);
dim3 grid((n + 31) / 32, (n + 7) / 8);
transpose_naive<<<grid, block>>>(d_out, d_in, n);
```

It is correct, and it is the obvious first version. Keep one fact about it in mind for the next episode: a warp is 32 consecutive threads of a block, which with this block shape is one row of it. The 32 threads of a warp share `threadIdx.y` and run `threadIdx.x` from 0 to 31, so they read 32 neighbouring elements of a row and write 32 elements of a column.

## The ceiling: a copy

A transpose does no arithmetic. Everything it costs is data movement, so the right thing to compare it with is a kernel that moves exactly the same bytes in the easiest possible order:

```cpp
__global__ void copy(float* out, const float* in, int n) {
  int x = blockIdx.x * blockDim.x + threadIdx.x;
  int y = blockIdx.y * blockDim.y + threadIdx.y;
  if (x < n && y < n) out[y * n + x] = in[y * n + x];
}
```

Same launch shape, same reads, same number of writes; only the destination order differs. In practice the copy is as fast as a transpose with this launch can hope to be, and the gap between the two is the subject of the series.

The bandwidth on the card's datasheet is a ceiling too, but no kernel reaches it. The copy is the ceiling you can actually hit on your own card, which makes it the useful one.

## The check

The reference is two loops on the CPU:

```cpp
for (int y = 0; y < n; ++y)
  for (int x = 0; x < n; ++x)
    ref[x * n + y] = in[y * n + x];
```

The comparison is exact equality on every element. A transpose moves bits and never rounds, so there is no floating-point error to forgive, and a tolerance would only give an indexing bug somewhere to hide.

What goes into the matrix matters as much. Filled with a smooth function, a kernel that is off by one row still produces values close to the right ones. Filled with each element's own index, `in[i] = (float)i`, every element is different, and a misplaced one cannot pass for the right one. At `n = 4096` that is 2²⁴ values, and every integer up to 2²⁴ is exactly representable as a float, so the fill is exact.

## One number

Every version in the series is reported as effective bandwidth: the bytes the kernel reads plus the bytes it writes, divided by the time it took. It is the measure the [CUDA C++ Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/) uses for memory-bound kernels, and it puts the transpose and the copy on the same scale.

For `n = 4096`, one transpose reads 4096² floats and writes as many: 2 × 4096² × 4 bytes, or 134,217,728 bytes, which is 128 MiB.

The time comes from CUDA events around the launch, after one warm-up launch that absorbs the first-call costs, and the reported value is the median of repeated runs:

```cpp
cudaEvent_t start, stop;
cudaEventCreate(&start);
cudaEventCreate(&stop);

transpose_naive<<<grid, block>>>(d_out, d_in, n);  // warm-up
std::vector<float> ms(20);
for (auto& t : ms) {
  cudaEventRecord(start);
  transpose_naive<<<grid, block>>>(d_out, d_in, n);
  cudaEventRecord(stop);
  cudaEventSynchronize(stop);
  cudaEventElapsedTime(&t, start, stop);
}
std::nth_element(ms.begin(), ms.begin() + ms.size() / 2, ms.end());
double seconds = ms[ms.size() / 2] / 1e3;
double gbps = 2.0 * n * n * sizeof(float) / seconds / 1e9;
```

Run the copy the same way. Two numbers come out of this episode: the copy's bandwidth and the naive transpose's. The ratio between them is the budget the next episodes have to win back, and it is different on every card, so record your own rather than borrowing someone else's.

## Sources

- NVIDIA, [CUDA C++ Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/), on effective bandwidth.
- Mark Harris, [An Efficient Matrix Transpose in CUDA C/C++](https://developer.nvidia.com/blog/efficient-matrix-transpose-cuda-cc/), NVIDIA Technical Blog, 2013. The series follows the same kernel and launch shape.
