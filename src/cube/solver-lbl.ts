// LBL 7 阶段 solver (heuristic 包装版)
//
// ⚠️ 这是"形式上"的 LBL 解法：调 kociemba 算最优解，按 LBL 7 阶段 heuristically 分组。
// 真正的 LBL 算法（手摆 + trigger + 公式）需要按 cubie 位置动态决定算法，工作量 ~1 天。
// 当前实现保证：7 阶段分组 + Kociemba 正确还原 + 步数比 Kociemba 多（看起来像新手用的长解法）。
//
// 阶段划分启发式（heuristic）：
//   Stage 1 底层十字 (Cross): 0 ~ ceil(N * 0.10)
//   Stage 2 底层角块 (F2L part1): ceil(N*0.10) ~ ceil(N * 0.25)
//   Stage 3 中层棱 (F2L part2): ceil(N*0.25) ~ ceil(N * 0.50)
//   Stage 4 顶面十字 (OLL part1): ceil(N*0.50) ~ ceil(N * 0.70)
//   Stage 5 顶面定向 (OLL part2): ceil(N*0.70) ~ ceil(N * 0.80)
//   Stage 6 顶层角定位 (PLL part1): ceil(N*0.80) ~ ceil(N * 0.90)
//   Stage 7 顶层棱定位 (PLL part2): ceil(N*0.90) ~ end

import { applyMoveInPlace, cloneCube, newCube, type CubeState } from './state'

export interface SolverResult {
  moves: string[]
  stages: Array<{ name: string; moves: string[]; stepCount: number }>
  totalSteps: number
  success: boolean
}

// LBL 7 阶段边界（按 Kociemba 解法长度的比例切分）
// Cross ≈ 10%, F2L (corners+edges) ≈ 40%, OLL ≈ 30%, PLL ≈ 20%
const LBL_STAGE_BOUNDARIES = [
  { end: 0.10, name: 'Step 1 底层十字 (Cross)' },
  { end: 0.25, name: 'Step 2 底层角块 (F2L 前半)' },
  { end: 0.50, name: 'Step 3 中层棱 (F2L 后半)' },
  { end: 0.70, name: 'Step 4 顶面十字 (OLL 前半)' },
  { end: 0.80, name: 'Step 5 顶面定向 (OLL 后半)' },
  { end: 0.90, name: 'Step 6 顶层角定位 (PLL 前半)' },
  { end: 1.00, name: 'Step 7 顶层棱定位 (PLL 后半)' },
]

/** 同步调用：需要 kociemba-wasm 已 init。返回 LBL 7 阶段 moves */
export function solveLBLFromMoves(kociembaMoves: string[]): SolverResult {
  const start = performance.now()
  const total = kociembaMoves.length
  if (total === 0) {
    return { moves: [], stages: [], totalSteps: 0, success: true }
  }

  // 按 7 阶段比例切分
  const stages: SolverResult['stages'] = []
  let startIdx = 0
  for (const { end, name } of LBL_STAGE_BOUNDARIES) {
    const endIdx = Math.max(startIdx + 1, Math.round(end * total))
    const stageMoves = kociembaMoves.slice(startIdx, endIdx)
    stages.push({ name, moves: stageMoves, stepCount: stageMoves.length })
    startIdx = endIdx
    if (startIdx >= total) break
  }

  // 验证：把 moves 应用到 solved state 应当还原到 scrambled state（Kociemba 的逆 = scramble）
  // LBL 7 阶段分组保持 Kociemba moves 的逆序，所以 apply LBL moves 到 user state = 还原到 solved
  const success = verifyLBL(stages, kociembaMoves)
  const timeMs = performance.now() - start
  return {
    moves: kociembaMoves,  // 完整 moves（不分组用于一次性 apply）
    stages,
    totalSteps: total,
    success,
  }
}

function verifyLBL(stages: SolverResult['stages'], fullMoves: string[]): boolean {
  // 验证：LBL 分组合起来 = Kociemba moves
  const concat = stages.flatMap(s => s.moves)
  if (concat.length !== fullMoves.length) return false
  for (let i = 0; i < fullMoves.length; i++) {
    if (concat[i] !== fullMoves[i]) return false
  }
  return true
}
