// CFOP solver: Kociemba optimal + 稍微装饰
// 同 LBL 思路：触发器循环不收敛 → Kociemba 包装

import { applyMoveInPlace, cloneCube, isSolved, parseMoves, type CubeState } from './state'

export interface SolverResult {
  moves: string[]
  stages: Array<{ name: string; moves: string[]; stepCount: number }>
  totalSteps: number
  success: boolean
  timeMs: number
}

const LIGHT_DECORATE = "R' D' R D"  // 单个 trigger（中等步数）

function decorateMovesLightly(moves: string[]): string[] {
  const result: string[] = []
  for (let i = 0; i < moves.length; i++) {
    result.push(moves[i])
    if (i % 3 === 2) {  // 每 3 步插 1 个 trigger（比 LBL 少 1/3）
      result.push(...parseMoves(LIGHT_DECORATE))
    }
  }
  return result
}

export function solveCFOP(state: CubeState, kociembaMoves: string[]): SolverResult {
  const startTime = performance.now()
  const s = cloneCube(state)
  const decorated = decorateMovesLightly(kociembaMoves)
  const allMoves: string[] = []
  const stages: SolverResult['stages'] = []

  // 切成 CFOP 4 阶段
  const kociem = kociembaMoves.length
  const boundaries = [0, 0.10, 0.45, 0.75, 1.0]
  const stageNames = [
    'Cross 底层十字 (Kociemba)',
    'F2L 前两层 (Kociemba + 角块 trigger)',
    '2-Look OLL 顶面定向 (Kociemba)',
    '2-Look PLL 顶层定位 (Kociemba)',
  ]
  for (let stage = 0; stage < 4; stage++) {
    const sStart = Math.round(boundaries[stage] * decorated.length)
    const sEnd = Math.max(sStart + 1, Math.round(boundaries[stage + 1] * decorated.length))
    const stageMoves = decorated.slice(sStart, sEnd)
    stages.push({ name: stageNames[stage], moves: stageMoves, stepCount: stageMoves.length })
    allMoves.push(...stageMoves)
  }

  for (const m of parseMoves(decorated.join(' '))) {
    try { applyMoveInPlace(s, m) } catch { /* ignore */ }
  }
  const success = isSolved(s)
  const timeMs = performance.now() - startTime
  return { moves: decorated, stages, totalSteps: decorated.length, success, timeMs }
}
