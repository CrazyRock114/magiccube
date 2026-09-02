// TopCubeSection — 顶部 3D 教具 section（贯穿整个 Solve 教学）
//
// 数据完全受控。父组件 Solve 持有 mainState。
// 组件职责：
// 1. 渲染 Cube3D + 2D MiniCube2D 同步显示主 cube 当前 state
// 2. 提供 18 个 move 按钮 + 公式输入框 → 逐个 move 触发动画 + 通知父组件更新 state
// 3. 撤销 / 重做（父组件持有 undo/redo 栈）
// 4. 打乱 / 重置按钮 → 弹确认弹窗（如果已有进度）
// 5. 显示当前达成步骤 / 进度

import { useState, useRef, useCallback } from 'react'
import { Cube3D, MiniCube2D } from './Cube3D'
import { parseMoves, parseMoveToken } from '../cube/state'
import type { CubeState } from '../cube/state'

export interface TopCubeSectionProps {
  mainState: CubeState
  scrambled: boolean
  completedCount: number
  totalSteps: number
  canUndo: boolean
  canRedo: boolean
  onApplyMoves: (moveSeq: string) => void
  onScramble: () => void
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
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

export function TopCubeSection({
  mainState, scrambled, completedCount, totalSteps,
  canUndo, canRedo,
  onApplyMoves, onScramble, onReset, onUndo, onRedo,
}: TopCubeSectionProps) {
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const [moveInput, setMoveInput] = useState('')
  const [showConfirm, setShowConfirm] = useState<'scramble' | 'reset' | null>(null)
  const isPlayingRef = useRef(false)

  // 应用 1 个 move：Cube3D 触发动画 + 通知父组件更新 state
  const applyOne = useCallback(async (m: string) => {
    if (isPlayingRef.current) return
    isPlayingRef.current = true
    setPendingMove(m)
    // 等待 450ms 动画（跟 Cube3D 内部匹配）
    await new Promise((r) => setTimeout(r, 450))
    setPendingMove(null)
    onApplyMoves(m)
    isPlayingRef.current = false
  }, [onApplyMoves])

  // 解析公式并逐个 apply
  const applySequence = useCallback(async (seq: string) => {
    if (isPlayingRef.current) return
    let moves: string[]
    try {
      moves = parseMoves(seq)
    } catch (e) {
      console.warn('parse failed:', seq, e)
      return
    }
    if (moves.length === 0) return
    for (const m of moves) {
      // 简单校验
      try { parseMoveToken(m) } catch (e) {
        console.warn('bad move:', m, e)
        break
      }
      await applyOne(m)
    }
  }, [applyOne])

  const handleScrambleClick = () => {
    if (completedCount > 0 || canUndo) {
      setShowConfirm('scramble')
    } else {
      onScramble()
    }
  }

  const handleResetClick = () => {
    if (completedCount > 0 || canUndo) {
      setShowConfirm('reset')
    } else {
      onReset()
    }
  }

  return (
    <section className="card bg-cube-bg/30 border-cube-accent border-2">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs text-cube-accent uppercase tracking-widest font-mono">主魔方 · 贯穿教学</div>
          <h3 className="text-lg font-semibold">
            {scrambled ? '还原中' : '未打乱'} · 已完成 {completedCount} / {totalSteps} 步
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScrambleClick}
            className="btn text-sm"
            title="打乱后开始尝试还原"
          >🎲 打乱</button>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="btn text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >↶ 撤销</button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="btn text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >↷ 重做</button>
          <button
            onClick={handleResetClick}
            className="btn text-sm"
            title="回到 solved 状态（清空所有进度）"
          >↺ 重置</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 items-start">
        {/* 左侧：3D 魔方 */}
        <div>
          <Cube3D
            state={mainState}
            pendingMove={pendingMove}
            onMoveApplied={() => { /* 动画完成由 applyOne 处理 */ }}
            height={360}
          />
          <div className="text-xs text-cube-muted font-mono mt-2 text-center">
            {pendingMove ? `⏵ 播放中: ${pendingMove}` : (isPlayingRef.current ? '⏵ 队列中...' : '○ 待命')}
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
                if (e.key === 'Enter' && !isPlayingRef.current) {
                  applySequence(moveInput).then(() => setMoveInput(''))
                }
              }}
              placeholder="输入公式 (例: R U R' U' 或 F R U R' U' F')"
              className="flex-1 px-3 py-1.5 rounded bg-cube-bg border border-cube-border text-cube-text font-mono text-sm focus:outline-none focus:border-cube-accent"
            />
            <button
              onClick={() => applySequence(moveInput).then(() => setMoveInput(''))}
              disabled={isPlayingRef.current}
              className="btn text-sm disabled:opacity-30"
            >▶ 应用</button>
          </div>

          {/* 18 个 move 按钮 */}
          <div className="grid grid-cols-6 gap-1.5">
            {MOVE_BUTTONS.map((b) => (
              MODIFIERS.map((mod) => (
                <button
                  key={b.code + mod}
                  onClick={() => applyOne(b.code + mod)}
                  disabled={isPlayingRef.current}
                  className="px-2 py-1.5 rounded font-mono text-sm font-bold transition hover:scale-105 disabled:opacity-50"
                  style={{ backgroundColor: b.color, color: b.textColor }}
                  title={`转 ${b.code}${mod}`}
                >
                  {b.code}{mod}
                </button>
              ))
            ))}
          </div>

          {/* 2D 同步预览 */}
          <div className="border-t border-cube-border pt-3 mt-3">
            <div className="text-xs text-cube-muted mb-2 font-mono">6 面 net 同步</div>
            <div className="flex justify-center">
              <MiniCube2D state={mainState} />
            </div>
          </div>
        </div>
      </div>

      {/* 确认弹窗 */}
      {showConfirm && (
        <ConfirmDialog
          action={showConfirm}
          completedCount={completedCount}
          onConfirm={() => {
            if (showConfirm === 'scramble') onScramble()
            else onReset()
            setShowConfirm(null)
          }}
          onCancel={() => setShowConfirm(null)}
        />
      )}
    </section>
  )
}

function ConfirmDialog({
  action, completedCount, onConfirm, onCancel,
}: {
  action: 'scramble' | 'reset'
  completedCount: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const isScramble = action === 'scramble'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card max-w-md mx-4 border-2 border-red-500/50">
        <div className="text-red-300 text-xs uppercase tracking-widest mb-2 font-mono">⚠️ 强提醒</div>
        <h3 className="text-xl font-semibold mb-3">
          {isScramble ? '确认重新打乱？' : '确认重置魔方？'}
        </h3>
        <p className="text-sm text-cube-text/90 leading-relaxed mb-2">
          {isScramble
            ? '打乱后所有还原进度和 history 都会被清空。'
            : '重置后回到 solved 状态，所有还原进度和 history 都会被清空。'}
        </p>
        <p className="text-sm text-cube-muted mb-4">
          当前已完成 <b className="text-cube-accent">{completedCount}</b> 步。
          建议先做完当前步骤，或在复盘表里记录你的解法。
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="btn text-sm">取消</button>
          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded bg-red-500 text-white font-semibold text-sm hover:bg-red-600"
          >{isScramble ? '确认打乱' : '确认重置'}</button>
        </div>
      </div>
    </div>
  )
}
