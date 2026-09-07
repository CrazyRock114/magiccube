// Scan 端：6 面 → Kociemba 内部 Cube class（绕过我 state.ts 引擎的 6 面 grid bug）
//
// 关键：用户输入的 6 面不能用 my 引擎的 getStickerString 转换（grid 公式跟 kociemba 不一致）
// 改用 kociemba-wasm 的 Cube class 直接处理 6 面
// 但 kociemba Cube 从 facelet 字符串构造，需要把 6 面按 kociemba 自己的 grid 顺序拼成 54 字符

import { Cube as KCube, init, solve as kSolve } from 'kociemba-wasm'
import type { Face } from './state'
import type { SixFaceInput } from './facelet'

const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

function sixFaceToFacelet(input: SixFaceInput): string {
  return FACE_ORDER.map(f => input[f].join('')).join('')
}

export interface ScanResultSuccess {
  ok: true
  moves: string[]
  timeMs: number
}

export interface ScanResultFailure {
  ok: false
  error: string
}

export type ScanResult = ScanResultSuccess | ScanResultFailure

let kociembaReady: Promise<unknown> | null = null
function ensureKociembaReady(): Promise<void> {
  if (!kociembaReady) {
    kociembaReady = init()
  }
  return kociembaReady as Promise<void>
}

export async function scanAndSolve(input: SixFaceInput): Promise<ScanResult> {
  const start = performance.now()
  try {
    await ensureKociembaReady()
    const facelet = sixFaceToFacelet(input)
    const sol = await kSolve(facelet)
    const trimmed = sol.trim()
    if (!trimmed) {
      return { ok: false, error: 'Kociemba 返回空解法 — 此状态不是合法魔方。' }
    }
    const moves = trimmed.split(/\s+/).filter(Boolean)
    if (moves.length === 0) {
      return { ok: false, error: '解法 0 步 — 状态已经是 solved 或不合法。' }
    }
    return { ok: true, moves, timeMs: performance.now() - start }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
