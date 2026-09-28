---
title: "Coalescing: what 32 threads ask of memory"
description: "A warp's 32 loads are served in as few 32-byte sectors as their addresses allow. Contiguous floats need 4; floats a row apart need 32. A transpose can make its reads contiguous or its writes, but not both."
date: 2026-09-28
part: 2
tags:
  - cuda
  - performance
claims:
  - figure: "12.5%"
    text: "of the bytes a warp fetches are used when its 32 threads read floats a row apart."
  - figure: "4 vs 32"
    text: "sectors per warp request: contiguous floats against floats a row apart."
  - quote: "Swapping the indices does not remove the strided side of a transpose. It moves it."
---

[[series/kernels-from-zero/01-a-correct-kernel|Episode 01]] left a correct transpose and a copy that moves the same bytes faster. This episode explains the gap by counting what each of them asks of memory, and tries the cheapest possible fix: swapping two indices.

## One instruction, 32 addresses

A warp executes one load instruction for all of its 32 threads at once. What reaches memory is not 32 requests but the set of 32-byte sectors those 32 addresses fall into; four consecutive sectors make up a 128-byte cache line. The cost of the instruction is the number of sectors it touches, whatever the number of threads.

When the 32 threads read 32 consecutive floats, 128 bytes starting on a sector boundary, the addresses fall into exactly 4 sectors and every byte fetched is used. This is what coalescing means: neighbouring threads asking for neighbouring words, so the hardware can serve the whole warp in the fewest transfers.

## Counting sectors

Spread the same 32 loads out and the count grows. With 4-byte floats, a warp whose threads are `s` floats apart covers `32 × 4 × s` bytes, which is `4 × s` sectors, until every thread has a sector to itself at 32:

| Stride between threads | Sectors per request | Bytes moved | Bytes used |
| ---------------------- | ------------------- | ----------- | ---------- |
| 1 float                | 4                   | 128         | 100%       |
| 2 floats               | 8                   | 256         | 50%        |
| 4 floats               | 16                  | 512         | 25%        |
| 8 floats               | 32                  | 1,024       | 12.5%      |
| 1 row (4096 floats)    | 32                  | 1,024       | 12.5%      |

The table assumes the warp's first address starts a sector, which it does for every access in this series. Past a stride of 8 floats the count stops growing, because each thread already has its own sector; a row apart is no worse than 8 floats apart, and no better.

## The naive kernel, counted

In the naive kernel a warp is 32 threads with consecutive `threadIdx.x` and one `threadIdx.y`:

```cpp
out[x * n + y] = in[y * n + x];
```

The read `in[y * n + x]` has neighbouring threads on neighbouring floats: stride 1, 4 sectors, all of it used. The write `out[x * n + y]` has neighbouring threads a whole row apart: stride 4096, 32 sectors, each in a different cache line, to store 128 bytes. The copy kernel writes `out[y * n + x]` instead and gets 4 sectors on both sides. That is the only difference between the two kernels, so it is where the gap comes from.

## Swapping the indices moves the problem

The cheapest change is to let the threads walk the other way:

```cpp
__global__ void transpose_read_strided(float* out, const float* in, int n) {
  int x = blockIdx.x * blockDim.x + threadIdx.x;
  int y = blockIdx.y * blockDim.y + threadIdx.y;
  if (x < n && y < n) out[y * n + x] = in[x * n + y];
}
```

Now the writes are contiguous and the reads are a row apart. It is still a correct transpose, it passes the same exact check, and it moves the same 128 MiB. What it does not do is remove the strided side. In a transpose, one of the two accesses runs along a row and the other down a column; changing which is which only decides whether the reads or the writes pay for it.

The two versions are not guaranteed to cost the same, and which one wins depends on the card. A strided read fetches a whole sector to use 4 bytes of it, but warps in neighbouring blocks read the rest of that sector soon after and may find it still in cache. Strided stores land in the L2 cache first as well, and how much of either pattern the cache absorbs before it reaches memory differs from one card to the next. So measure both, the same way as in episode 01, and write both numbers down next to the copy. Expect neither to reach it.

## What the next change has to do

To make both sides contiguous, the kernel needs somewhere to turn a piece of the matrix around where reading down a column is cheap: read a tile in rows, keep it on chip, write it out in rows of the transposed tile. That place is shared memory, and [[series/kernels-from-zero/03-shared-memory-tiles|episode 03]] builds it, along with the one new problem it brings.

## Sources

- NVIDIA, [CUDA C++ Best Practices Guide](https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/), section on coalesced access to global memory.
- Mark Harris, [How to Access Global Memory Efficiently in CUDA C/C++ Kernels](https://developer.nvidia.com/blog/how-access-global-memory-efficiently-cuda-c-kernels/), NVIDIA Technical Blog, 2013.
