import { useState, useRef, useCallback } from 'react'
import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { newCube, applyMoveInPlace, isSolved, parseMoves, cloneCube } from '../cube/state'
import { CubeState } from '../cube/state'
import { ALGORITHMS } from '../cube/algorithms'

const SECTIONS: { id: string; title: string; algorithms: typeof ALGORITHMS }[] = [
  { id: 'basic', title: '基础 / 单步循环', algorithms: ALGORITHMS.filter(a => a.category === 'basic' || a.category === 'commutator' || a.category === 'conjugate') },
  { id: 'oll', title: 'OLL（顶面定向）', algorithms: ALGORITHMS.filter(a => a.category === 'OLL') },
  { id: 'pll', title: 'PLL（顶层定位）', algorithms: ALGORITHMS.filter(a => a.category === 'PLL') },
]

function findOrder(notation: string): number {
  const c = newCube(3)
  const list = parseMoves(notation)
  for (let i = 1; i <= 200; i++) {
    for (const m of list) applyMoveInPlace(c, m)
    if (isSolved(c)) return i
  }
  return -1
}

function MoveStepper({ algorithm }: { algorithm: typeof ALGORITHMS[0] }) {
  const [cube, setCube] = useState<CubeState>(() => {
    const c = newCube(3)
    applyMoveInPlace(c, algorithm.notation.replace(/\s+/g, ' '))
    return c
  })
  const [stepIdx, setStepIdx] = useState(0)
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 关键修复：state 在动画开始时**不变**，只由 onMoveApplied 在动画结束时 apply
  // 这样 stickers 不会在动画开始瞬间跳到终态，而是跟着 group rotation 视觉转动
  const queueRef = useRef<string[]>([])
  const currentMoveRef = useRef<string | null>(null)
  const moves = parseMoves(algorithm.notation)

  const triggerNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      currentMoveRef.current = null
      setPendingMove(null)
      setBusy(false)
      return
    }
    const next = queueRef.current.shift()!
    currentMoveRef.current = next
    setPendingMove(next)
  }, [])

  const onAnimationDone = useCallback(() => {
    // 动画结束：apply 当前 move 到 state，stepIdx +1
    const finishedMove = currentMoveRef.current
    if (finishedMove) {
      setCube(c => {
        const nc = cloneCube(c)
        applyMoveInPlace(nc, finishedMove)
        return nc
      })
    }
    setStepIdx(i => i + 1)
    triggerNext()
  }, [triggerNext])

  const playAll = () => {
    if (busy) return
    setBusy(true)
    setCube(newCube(3))
    setStepIdx(0)
    queueRef.current = [...moves]
    triggerNext()
  }

  const playNext = () => {
    if (busy || stepIdx >= moves.length) return
    setBusy(true)
    queueRef.current = [moves[stepIdx]]
    triggerNext()
  }

  const playPrev = () => {
    if (busy || stepIdx === 0) return
    const nextIdx = stepIdx - 1
    const c = newCube(3)
    for (let i = 0; i < nextIdx; i++) {
      applyMoveInPlace(c, moves[i])
    }
    setCube(c)
    setStepIdx(nextIdx)
  }

  const reset = () => {
    setCube(newCube(3))
    setStepIdx(0)
    setPendingMove(null)
    setBusy(false)
    queueRef.current = []
    currentMoveRef.current = null
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">{algorithm.name}</div>
          <div className="text-xs text-cube-muted">{algorithm.description} · 阶 {algorithm.order}</div>
        </div>
        <div className="text-xs text-cube-accent font-mono">{algorithm.group}</div>
      </div>

      <div className="font-mono text-sm mb-3 text-cube-text/90 break-all leading-relaxed">
        {moves.map((m, i) => (
          <span key={i} className={`inline-block px-1.5 py-0.5 mx-0.5 rounded ${i < stepIdx ? 'bg-green-900/40 text-green-300' : i === stepIdx ? 'bg-cube-accent text-white' : 'bg-cube-bg text-cube-muted'}`}>{m}</span>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Cube3D
          state={cube}
          pendingMove={pendingMove}
          onMoveApplied={onAnimationDone}
          height={280}
          showControls={false}
        />
        <div className="space-y-2">
          <MiniCube2D state={cube} />
          <div className="text-xs text-cube-muted font-mono">
            步 {stepIdx} / {moves.length} · {isSolved(cube) ? '已复原' : '打乱中'}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn" onClick={reset} disabled={busy}>↺</button>
            <button className="btn" onClick={playPrev} disabled={busy || stepIdx === 0}>←</button>
            <button className="btn" onClick={playNext} disabled={busy || stepIdx >= moves.length}>→</button>
            <button className="btn-primary" onClick={playAll} disabled={busy}>▶ 全部</button>
          </div>
          <button
            className="btn-ghost w-full text-xs"
            onClick={() => {
              const order = findOrder(algorithm.notation)
              alert(`算法 "${algorithm.name}" 的阶 = ${order}（重复 ${order} 次后回到原状）`)
            }}
          >检查阶数</button>
        </div>
      </div>
    </div>
  )
}

export function AlgorithmViz() {
  const [filter, setFilter] = useState<string>('all')

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3/algos</div>
        <h1 className="h1">公式拆解</h1>
        <p className="lead">每个公式 3D 逐步播放。点 <b>▶ 全部</b> 看连贯动画，点 <b>→</b> 单步推进。同时看展开图理解每个面受影响情况。</p>
      </header>

      <div className="flex gap-2 flex-wrap">
        <button
          className={`btn ${filter === 'all' ? 'bg-cube-accent/20 border-cube-accent' : ''}`}
          onClick={() => setFilter('all')}
        >全部</button>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`btn ${filter === s.id ? 'bg-cube-accent/20 border-cube-accent' : ''}`}
            onClick={() => setFilter(s.id)}
          >{s.title}</button>
        ))}
      </div>

      {SECTIONS.filter(s => filter === 'all' || filter === s.id).map(section => (
        <section key={section.id} className="space-y-4">
          <h2 className="h3">{section.title}</h2>
          {section.algorithms.map(algo => (
            <MoveStepper key={algo.name} algorithm={algo} />
          ))}
        </section>
      ))}
    </div>
  )
}
