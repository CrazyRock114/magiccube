// 最优解 solver（大师解法）— 深度限制 BFS
//
// 目标：找到比 LBL/CFOP 短的解法（理想 ~20-30 步）。
// 实现：迭代加深 DFS (IDDFS) + corner/edge 启发式 + 剪枝。
//
// 限制：
// - 深度限制 12（>12 在 JS 里会非常慢）
// - 如果 12 步内找不到解，回退到 CFOP 解法
// - 用 sticker count heuristic（已对齐 sticker 数）做下界估计

import { applyMoveInPlace, cloneCube, isSolved, parseMoveToken, type CubeState } from './state'
import { solveCFOP, type SolverResult } from './solver-cfop'
import { rotateVec } from './quat'
import type { Face } from './state'
import type { Vec3 } from './quat'

// 18 个标准 move（不含 '2 / ' 等 modifier 在 BFS 中分别处理）
const ALL_MOVES = ['U', "U'", "U2", 'D', "D'", "D2", 'R', "R'", "R2", 'L', "L'", "L2", 'F', "F'", "F2", 'B', "B'", "B2"]

// heuristic: 已正确位置+朝向的 sticker 数
function correctStickerCount(state: CubeState): number {
  let count = 0
  for (const cu of state.cubies) {
    for (const s of cu.stickers) {
      const wn = rotateVec(cu.ori, s.normal) as Vec3
      let expected: Face
      if (Math.abs(wn[1] - 1) < 0.5) expected = 'U'
      else if (Math.abs(wn[1] + 1) < 0.5) expected = 'D'
      else if (Math.abs(wn[0] - 1) < 0.5) expected = 'R'
      else if (Math.abs(wn[0] + 1) < 0.5) expected = 'L'
      else if (Math.abs(wn[2] - 1) < 0.5) expected = 'F'
      else if (Math.abs(wn[2] + 1) < 0.5) expected = 'B'
      else continue
      if (s.color === expected) count++
    }
  }
  return count
}

// 下界：每个未对齐 sticker 至少需要 1 步来纠正（粗略估计）
// 实际：54 stickers 中 26 中心 (6 face center = fixed 实际上只有 20 个需要 work)
// 简化下界：(54 - correctCount) / 8  ≈ 大概需要的最少步数
function heuristicLowerBound(state: CubeState): number {
  const correct = correctStickerCount(state)
  return Math.max(0, Math.ceil((54 - correct) / 8))
}

// IDDFS：迭代加深 + 启发式剪枝
function iddfs(state: CubeState, maxDepth: number, timeLimit: number): string[] | null {
  const start = performance.now()
  // Move ordering: 先做 half-turn moves (X2) 通常更有结构性
  const moveOrder = ALL_MOVES

  function dfs(s: CubeState, depth: number, path: string[], lastFace: string | null): string[] | null {
    if (performance.now() - start > timeLimit) return null
    if (isSolved(s)) return path
    if (depth >= maxDepth) return null
    const h = heuristicLowerBound(s)
    if (h > maxDepth - depth) return null  // 启发式剪枝

    for (const m of moveOrder) {
      // 不连续做同一面
      const face = m[0]
      if (lastFace === face) continue
      const next = cloneCube(s)
      try {
        parseMoveToken(m)
        applyMoveInPlace(next, m)
      } catch { continue }
      const result = dfs(next, depth + 1, [...path, m], face)
      if (result) return result
    }
    return null
  }

  return dfs(state, 0, [], null)
}

export function solveOptimal(state: CubeState): SolverResult {
  const startTime = performance.now()
  const TIME_LIMIT = 5000  // 5 秒超时
  const MAX_DEPTH = 12  // BFS 深度限制

  // 尝试深度 1-12
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const found = iddfs(state, depth, TIME_LIMIT)
    if (found) {
      return {
        moves: found,
        stages: [
          { name: `Optimal (depth ${depth})`, moves: found, stepCount: found.length },
        ],
        totalSteps: found.length,
        success: true,
      }
    }
    if (performance.now() - startTime > TIME_LIMIT) break
  }

  // 超时或超过深度：回退到 CFOP（标注为 suboptimal）
  const cfop = solveCFOP(state)
  return {
    moves: cfop.moves,
    stages: [
      { name: 'Optimal (超时回退到 CFOP)', moves: cfop.moves, stepCount: cfop.totalSteps },
    ],
    totalSteps: cfop.totalSteps,
    success: cfop.success,
  }
}
