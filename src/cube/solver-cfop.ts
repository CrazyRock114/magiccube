// 2-Look CFOP solver（4 阶段包装版）
//
// 同 LBL：调 Kociemba 算解法 + 按 CFOP 4 阶段（Cross / F2L / OLL / PLL）heuristic 分组。
// 真正 CFOP 算法（同 LBL）需要按 cubie 位置动态决定，工作量 ~1 天。

import type { SolverResult } from './solver-lbl'

const CFOP_STAGE_BOUNDARIES = [
  { end: 0.10, name: 'Cross 底层十字' },
  { end: 0.45, name: 'F2L 前两层' },
  { end: 0.75, name: '2-Look OLL 顶面定向' },
  { end: 1.00, name: '2-Look PLL 顶层定位' },
]

export type { SolverResult }

export function solveCFOPFromMoves(kociembaMoves: string[]): SolverResult {
  const total = kociembaMoves.length
  if (total === 0) {
    return { moves: [], stages: [], totalSteps: 0, success: true }
  }
  const stages: SolverResult['stages'] = []
  let startIdx = 0
  for (const { end, name } of CFOP_STAGE_BOUNDARIES) {
    const endIdx = Math.max(startIdx + 1, Math.round(end * total))
    const stageMoves = kociembaMoves.slice(startIdx, endIdx)
    stages.push({ name, moves: stageMoves, stepCount: stageMoves.length })
    startIdx = endIdx
    if (startIdx >= total) break
  }
  return { moves: kociembaMoves, stages, totalSteps: total, success: true }
}
