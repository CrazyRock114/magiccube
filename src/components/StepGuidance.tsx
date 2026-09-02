// StepGuidance — 单步只读教学卡
//
// 替代 InteractiveStepCard。操作移到顶部 TopCubeSection（单一主教具贯穿），
// 本卡只展示：标题 / 目标 / 公式 / 技巧 / 警告 / 状态徽章 / 进度提示。
//
// 数据完全受控，外部传入 currentState 以便实时显示该 step 距离达成还差多远。

import { useMemo } from 'react'
import { CubeState } from '../cube/state'

export interface StepGuidanceProps {
  stepNumber: number
  title: string
  goal: string
  hint: string
  algorithm?: { name: string; notation: string; when?: string }
  tips?: string[]
  warnings?: string[]
  status: 'locked' | 'active' | 'completed'
  // 可选：计算当前主 cube 距离 step 目标还差多少（基于 sticker 颜色匹配）
  progress?: { matched: number; total: number }
}

export function StepGuidance({
  stepNumber, title, goal, hint, algorithm, tips, warnings,
  status, progress,
}: StepGuidanceProps) {
  return (
    <div className={`card mb-4 transition-all ${
      status === 'completed' ? 'border-cube-accent border-2 bg-cube-accent/5' :
      status === 'locked' ? 'opacity-40 border-dashed' :
      'border-cube-muted'
    }`}>
      <div className="flex items-baseline gap-3 mb-2">
        <span className={`font-mono font-bold text-lg ${
          status === 'completed' ? 'text-cube-accent' :
          status === 'locked' ? 'text-cube-muted' : 'text-cube-text'
        }`}>
          Step {stepNumber}
        </span>
        <h3 className="text-xl font-semibold flex-1">
          {status === 'locked' ? '🔒 ' : ''}{title}
        </h3>
        <StatusBadge status={status} />
      </div>

      {status !== 'locked' && (
        <>
          <div className="text-sm text-cube-text/90 leading-relaxed mb-3">
            <span className="text-cube-muted">目标：</span>{goal}
          </div>

          {progress && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-cube-muted">当前进度</span>
                <span className={progress.matched === progress.total ? 'text-green-400' : 'text-cube-muted'}>
                  {progress.matched} / {progress.total}
                </span>
              </div>
              <div className="w-full h-1.5 bg-cube-bg rounded overflow-hidden">
                <div
                  className="h-full bg-cube-accent transition-all duration-300"
                  style={{ width: `${(progress.matched / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {algorithm && (
            <div className="bg-cube-bg border-l-2 border-cube-accent px-4 py-3 mb-3 font-mono">
              <div className="text-cube-muted text-xs mb-1">关键公式</div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-semibold">{algorithm.name}</span>
                <span className="text-cube-accent">{algorithm.notation}</span>
              </div>
              {algorithm.when && <div className="text-xs text-cube-muted mt-2">使用时机：{algorithm.when}</div>}
            </div>
          )}

          {tips && tips.length > 0 && (
            <div className="text-sm text-cube-text/80 mb-2">
              <div className="text-cube-muted text-xs mb-1">💡 技巧</div>
              <ul className="list-disc ml-5 space-y-1">
                {tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {warnings && warnings.length > 0 && (
            <div className="text-sm text-cube-text/80 mt-2">
              <div className="text-red-300 text-xs mb-1">⚠️ 常见错误</div>
              <ul className="list-disc ml-5 space-y-1">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {status !== 'completed' && (
            <div className="mt-3 text-xs p-2 rounded font-mono bg-cube-bg/50 text-cube-muted">
              💡 提示：{hint}
            </div>
          )}
        </>
      )}

      {status === 'locked' && (
        <div className="text-sm text-cube-muted">
          请先完成上一步，解锁本步。
        </div>
      )}

      {status === 'completed' && (
        <div className="mt-2 text-xs p-2 rounded font-mono bg-green-500/10 text-green-300 border border-green-500/30">
          🎉 已达成，继续操作主魔方解锁下一步
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'locked' | 'active' | 'completed' }) {
  if (status === 'completed') {
    return <span className="pill-move bg-green-500 text-white">✓ 已完成</span>
  }
  if (status === 'active') {
    return <span className="pill-move bg-cube-accent text-cube-bg">⏳ 进行中</span>
  }
  return <span className="pill-move bg-cube-bg text-cube-muted">🔒 未解锁</span>
}
