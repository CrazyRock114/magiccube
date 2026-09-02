// InteractiveStepCard — Solve 页单步互动卡
//
// 功能：
// 1. 顶部 MiniCube2D 实时显示用户当前 state
// 2. 18 个 move 按钮（6 面 × 3 modifier）+ 公式输入框 → 自由尝试
// 3. 撤销/重置/打乱按钮
// 4. 每次 state 变 → 自动调 checker() → 达成时通知父组件 → 解锁下一步
// 5. 上一步未完成时本卡灰锁 + 不响应

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { MiniCube2D } from './Cube3D'
import {
  newCube, applyMoveInPlace, cloneCube, parseMoveToken, parseMoves,
} from '../cube/state'
import type { CubeState } from '../cube/state'

// 用 seed 做伪随机 scramble（保证每步起始 state 可复现）
function makeScrambled(seed: number, length = 18): CubeState {
  const c = newCube(3)
  const moves = ['U', 'D', 'R', 'L', 'F', 'B', "U'", "D'", "R'", "L'", "F'", "B'"]
  let last = -1
  let s = seed
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    let m = moves[s % moves.length]
    let face = m[0]
    let attempts = 0
    while (face.charCodeAt(0) === last && attempts < 5) {
      s = (s * 1103515245 + 12345) & 0x7fffffff
      m = moves[s % moves.length]
      face = m[0]
      attempts++
    }
    applyMoveInPlace(c, m)
    last = face.charCodeAt(0)
  }
  return c
}

const MOVE_BUTTONS = [
  { code: 'U', color: '#f5f5f5', textColor: '#0a0a14' },
  { code: 'D', color: '#ffd500', textColor: '#0a0a14' },
  { code: 'R', color: '#b71234', textColor: '#fff' },
  { code: 'L', color: '#ff5900', textColor: '#0a0a14' },
  { code: 'F', color: '#009b48', textColor: '#fff' },
  { code: 'B', color: '#0046ad', textColor: '#fff' },
]

const MODIFIERS = ['', "'", '2']

export interface InteractiveStepCardProps {
  stepNumber: number
  title: string
  goal: string
  hint: string
  checker: (state: CubeState) => boolean
  scrambleSeed: number
  locked: boolean
  completed: boolean
  onComplete: () => void
}

export function InteractiveStepCard({
  stepNumber, title, goal, hint, checker, scrambleSeed,
  locked, completed, onComplete,
}: InteractiveStepCardProps) {
  // 起始 state：per-step scramble seed（保证可复现 + 每步独立）
  const initialState = useMemo(() => makeScrambled(scrambleSeed, 18), [scrambleSeed])
  const [userState, setUserState] = useState<CubeState>(initialState)
  const [history, setHistory] = useState<CubeState[]>([])
  const [moveInput, setMoveInput] = useState('')
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const completedRef = useRef(completed)
  completedRef.current = completed

  const applyOneMove = useCallback((m: string) => {
    if (locked) return
    setHistory((h) => [...h, cloneCube(userState)])
    setUserState((prev) => {
      const next = cloneCube(prev)
      try {
        applyMoveInPlace(next, m)
      } catch (e) {
        console.warn('bad move:', m, e)
        return prev
      }
      return next
    })
  }, [locked, userState])

  const applySequence = useCallback((seq: string) => {
    if (locked) return
    let moves: string[] = []
    try { moves = parseMoves(seq) } catch (e) {
      console.warn('parse failed:', seq, e)
      return
    }
    if (moves.length === 0) return
    setHistory((h) => [...h, cloneCube(userState)])
    setUserState((prev) => {
      const next = cloneCube(prev)
      for (const m of moves) {
        try { applyMoveInPlace(next, m) } catch (e) {
          console.warn('bad move in seq:', m, e)
          break
        }
      }
      return next
    })
  }, [locked, userState])

  const undo = useCallback(() => {
    if (locked) return
    setHistory((h) => {
      if (h.length === 0) return h
      const last = h[h.length - 1]
      setUserState(last)
      return h.slice(0, -1)
    })
  }, [locked])

  const reset = useCallback(() => {
    if (locked) return
    setHistory([])
    setUserState(makeScrambled(scrambleSeed, 18))
  }, [locked, scrambleSeed])

  // 自动检测：state 变 → 调 checker
  useEffect(() => {
    if (locked) return
    if (completedRef.current) return
    if (checker(userState)) {
      onCompleteRef.current()
    }
  }, [userState, checker, locked])

  // 锁定时：显示初始打乱态 + 不响应（只读模式）
  if (locked) {
    return (
      <div className="card mb-4 opacity-40 border-dashed">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="font-mono font-bold text-cube-muted text-lg">Step {stepNumber}</span>
          <h3 className="text-xl font-semibold flex-1">🔒 {title}</h3>
        </div>
        <div className="text-sm text-cube-muted">
          请先完成上一步，解锁本步。
        </div>
      </div>
    )
  }

  return (
    <div className={`card mb-4 transition-all ${completed ? 'border-cube-accent border-2 bg-cube-accent/5' : ''}`}>
      <div className="flex items-baseline gap-3 mb-2">
        <span className={`font-mono font-bold text-lg ${completed ? 'text-cube-accent' : 'text-cube-muted'}`}>
          Step {stepNumber}
        </span>
        <h3 className="text-xl font-semibold flex-1">{title}</h3>
        {completed ? (
          <span className="pill-move bg-green-500 text-white">✓ 已完成</span>
        ) : (
          <span className="pill-move bg-cube-bg text-cube-muted">进行中</span>
        )}
      </div>
      <div className="text-sm text-cube-text/90 leading-relaxed mb-3">
        <span className="text-cube-muted">目标：</span>{goal}
      </div>

      <div className="grid md:grid-cols-[auto_1fr] gap-4 items-start">
        {/* 左侧：小 2D 视图 */}
        <div className="flex flex-col items-center">
          <MiniCube2D state={userState} />
          <div className="text-xs text-cube-muted mt-2 font-mono">
            步数: {history.length}
          </div>
        </div>

        {/* 右侧：操作面板 */}
        <div className="space-y-3">
          {/* 公式输入 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={moveInput}
              onChange={(e) => setMoveInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applySequence(moveInput)
                  setMoveInput('')
                }
              }}
              placeholder="输入公式: R U R' U'"
              className="flex-1 px-3 py-1.5 rounded bg-cube-bg border border-cube-border text-cube-text font-mono text-sm focus:outline-none focus:border-cube-accent"
            />
            <button
              onClick={() => { applySequence(moveInput); setMoveInput('') }}
              className="btn text-sm"
            >应用</button>
          </div>

          {/* 18 个 move 按钮 */}
          <div className="grid grid-cols-6 gap-1.5">
            {MOVE_BUTTONS.map((b) => (
              MODIFIERS.map((mod) => (
                <button
                  key={b.code + mod}
                  onClick={() => applyOneMove(b.code + mod)}
                  className="px-2 py-1.5 rounded font-mono text-sm font-bold transition hover:scale-105"
                  style={{ backgroundColor: b.color, color: b.textColor }}
                  title={`转 ${b.code}${mod}`}
                >
                  {b.code}{mod}
                </button>
              ))
            ))}
          </div>

          {/* 控制按钮 */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="btn text-xs disabled:opacity-30 disabled:cursor-not-allowed"
            >↶ 撤销</button>
            <button
              onClick={reset}
              className="btn text-xs"
            >↺ 重置</button>
            <button
              onClick={() => applyOneMove("U")}
              className="btn text-xs"
              title="U 调整视角（不动当前步的检测）"
            >👁 U</button>
          </div>

          {/* 状态提示 */}
          <div className={`text-xs p-2 rounded font-mono ${
            completed
              ? 'bg-green-500/10 text-green-300 border border-green-500/30'
              : 'bg-cube-bg/50 text-cube-muted'
          }`}>
            {completed ? '🎉 达成！下一步已解锁' : `💡 提示：${hint}`}
          </div>
        </div>
      </div>
    </div>
  )
}
