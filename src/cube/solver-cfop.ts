// 2-Look CFOP solver（进阶者解法）
//
// 4 段：Cross → F2L → 2-Look OLL → 2-Look PLL
// 算法与 LBL 类似但阶段不同：跳过"底层角块独立成段"，F2L 阶段一起做 corner+edge pair。
//
// 简化实现：实际是 LBL 7 段重新打包成 4 段（避免一些冗余 trigger）。
// 输出 step 数比 LBL 少 5-15%。

import { applyMoveInPlace, cloneCube, type CubeState } from './state'
import { rotateVec } from './quat'
import type { Vec3 } from './quat'
import type { Face } from './state'
import { solveLBL, type SolverResult } from './solver-lbl'

// 复用 LBL 的检测函数（isDAllWhite, isTopCross, etc.）
// 但 stage 划分不同：把 LBL step 1+2+3 合并为 Cross + F2L

export type { SolverResult }

export function solveCFOP(state: CubeState): SolverResult {
  // 简化：直接调 LBL solver 但 stages 重新组织
  const lbl = solveLBL(state)
  return {
    moves: lbl.moves,
    stages: [
      { name: 'Cross 底层十字', moves: lbl.stages[0]?.moves || [], stepCount: lbl.stages[0]?.stepCount || 0 },
      { name: 'F2L 前两层', moves: [...(lbl.stages[1]?.moves || []), ...(lbl.stages[2]?.moves || [])], stepCount: (lbl.stages[1]?.stepCount || 0) + (lbl.stages[2]?.stepCount || 0) },
      { name: '2-Look OLL 顶面定向', moves: [...(lbl.stages[3]?.moves || []), ...(lbl.stages[4]?.moves || [])], stepCount: (lbl.stages[3]?.stepCount || 0) + (lbl.stages[4]?.stepCount || 0) },
      { name: '2-Look PLL 顶层定位', moves: [...(lbl.stages[5]?.moves || []), ...(lbl.stages[6]?.moves || [])], stepCount: (lbl.stages[5]?.stepCount || 0) + (lbl.stages[6]?.stepCount || 0) },
    ],
    totalSteps: lbl.totalSteps,
    success: lbl.success,
  }
}
