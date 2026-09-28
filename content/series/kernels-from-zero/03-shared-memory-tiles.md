---
title: Shared memory and the bank conflict
description: "Staging a 32 × 32 tile in shared memory makes both the reads and the writes contiguous. Reading the tile down a column then hits one bank 32 times, and one column of padding spreads it across all 32."
date: 2026-09-28
part: 3
tags:
  - cuda
  - performance
claims:
  - figure: "33"
    text: "columns in a 32-wide shared tile, so a column read spreads across 32 banks instead of hitting one 32 times."
  - figure: "128 bytes"
    text: "of padding per block is the whole cost of removing the conflict."
  - quote: "Without the barrier the output is wrong only sometimes, which is exactly when an exact check earns its keep."
---

[[series/kernels-from-zero/02-coalescing|Episode 02]] ended on a constraint: in a transpose, one of the two global accesses runs down a column, and swapping indices only chooses which. This episode moves the column access somewhere it is cheap. Each block reads a tile of the matrix in rows, turns it around in shared memory, and writes it out in rows.

## Turn the tile around on chip

Shared memory is on the chip, private to a block, and served in banks rather than in 32-byte sectors. A block can fill it with contiguous reads from global memory, wait, and then read it in whatever order the transpose needs:

```cpp
constexpr int TILE = 32;
constexpr int ROWS = 8;

__global__ void transpose_tiled(float* out, const float* in, int n) {
  __shared__ float tile[TILE][TILE + 1];

  int x = blockIdx.x * TILE + threadIdx.x;
  int y = blockIdx.y * TILE + threadIdx.y;
  for (int j = 0; j < TILE; j += ROWS)
    tile[threadIdx.y + j][threadIdx.x] = in[(y + j) * n + x];

  __syncthreads();

  x = blockIdx.y * TILE + threadIdx.x;  // the transposed tile's corner
  y = blockIdx.x * TILE + threadIdx.y;
  for (int j = 0; j < TILE; j += ROWS)
    out[(y + j) * n + x] = tile[threadIdx.x][threadIdx.y + j];
}

dim3 block(TILE, ROWS);
dim3 grid(n / TILE, n / TILE);  // n is a multiple of 32 in this series
```

Both global accesses now have neighbouring threads on neighbouring floats: the read `in[(y + j) * n + x]` and the write `out[(y + j) * n + x]` each touch 4 sectors per warp, the same as the copy. The column access is still there, in `tile[threadIdx.x][threadIdx.y + j]`, but it happens in shared memory, and the `TILE + 1` in the declaration is what keeps it cheap. That is the second half of this episode.

## Four elements per thread

The block is still 32 × 8 threads, but it now covers a 32 × 32 tile, so each thread moves four elements, one per turn of the `j` loop. The series' rule is one change per episode, and this one forces a second: staging a whole tile is the idea, and a tile four times taller than the block is how it fits the block shape from episode 01. The grid shrinks by the same factor of four.

## The barrier

The `__syncthreads()` between the two loops is not optional. The second loop reads tile elements that other threads of the block wrote in the first, and nothing else guarantees those writes have happened.

Without it the kernel still compiles, still runs, and is still right most of the time, because most of the time the other warps happen to be done. Wrong only sometimes is the worst kind of wrong, and it is what the exact check from [[series/kernels-from-zero/01-a-correct-kernel|episode 01]] is for: with every element holding its own index, a single element read before it was written fails the comparison.

## Banks

Shared memory is divided into 32 banks, and successive 4-byte words go to successive banks, so a word at index `i` lives in bank `i mod 32`. When the 32 threads of a warp access 32 different banks, the access completes in one step. When several of them hit different words in the same bank, the hardware serves them one after another. That is a bank conflict, and 32 threads on one bank is a 32-way conflict: the access takes 32 steps instead of one.

The first loop writes a row of the tile: thread `t` of the warp writes word `row × width + t`, so 32 threads land on 32 consecutive words and 32 different banks. The second loop reads a column: thread `t` reads `tile[t][c]`, the word at `t × width + c`. With a width of 32:

- `32 × t + c` leaves the remainder `c` for every `t`, so all 32 threads land in bank `c`, a 32-way conflict.

With a width of 33, one unused column of padding:

- `33 × t + c` leaves the remainder `(t + c) mod 32`, which is different for each of the 32 threads, so the column spreads across all 32 banks and completes in one step.

The padding costs 32 floats per block: the tile grows from 4,096 bytes to 4,224. That is 128 bytes of shared memory for turning a 32-way conflict into none.

## What to record

Three numbers now sit next to the copy from episode 01: the tiled kernel with a width of 32, the same kernel with a width of 33, and, from episode 02, the better of the two single-index versions. Measure them the same way, median of repeated runs after a warm-up. The padded tile is the one expected to come closest to the copy. How close depends on the card, which is where the next two episodes pick up: how many of these blocks the card keeps in flight at once, and what the profiler says about where the remaining time goes.

## Sources

- NVIDIA, [CUDA C++ Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/), section on shared memory and bank conflicts.
- Mark Harris, [Using Shared Memory in CUDA C/C++](https://developer.nvidia.com/blog/using-shared-memory-cuda-cc/), NVIDIA Technical Blog, 2013.
- Mark Harris, [An Efficient Matrix Transpose in CUDA C/C++](https://developer.nvidia.com/blog/efficient-matrix-transpose-cuda-cc/), NVIDIA Technical Blog, 2013. The tiled kernel above follows it.
