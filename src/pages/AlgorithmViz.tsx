import { useState, useRef, useCallback, useEffect } from 'react'
import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { CubeModel, newCube, applyMove, applyMoves, getStickerString, fromStickerString, parseMoves, invertMoves, isSolved } from '../cube/state'
import { ALGORITHMS } from '../cube/algorithms'

const SECTIONS: { id: string; title: string; algorithms: typeof ALGORITHMS }[] = [
  { id: 'basic', title: '基础 / 单步循环', algorithms: ALGORITHMS.filter(a => a.category === 'basic' || a.category === 'commutator' || a.category === 'conjugate') },
  { id: 'oll', title: 'OLL（顶面定向）', algorithms: ALGORITHMS.filter(a => a.category === 'OLL') },
  { id: 'pll', title: 'PLL（顶层定位）', algorithms: ALGORITHMS.filter(a => a.category === 'PLL') },
]

function findOrder(moves: string): number {
  const c = newCube()
  const list = parseMoves(moves)
  for (let i = 1; i <= 200; i++) {
    for (const m of list) applyMove(c, m)
    if (isSolved(c)) return i
  }
  return -1
}

function MoveStepper({ algorithm, expanded }: { algorithm: typeof ALGORITHMS[0]; expanded: boolean }) {
  const [cube, setCube] = useState<CubeModel>(() => {
    const c = newCube()
    applyMoves(c, algorithm.notation)
    return c
  })
  const [stepIdx, setStepIdx] = useState(0)
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const queueRef = useRef<string[]>([])
  const moves = parseMoves(algorithm.notation)

  const stepCube = useCallback((idx: number) => {
    const c = newCube()
    for (let i = 0; i < idx; i++) {
      applyMove(c, moves[i])
    }
    return c
  }, [moves])

  const onAnimationDone = useCallback(() => {
    setPendingMove(null)
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!
      const targetIdx = stepIdx + 1
      setCube(stepCube(targetIdx))
      setStepIdx(targetIdx)
      setPendingMove(next)
    } else {
      setBusy(false)
    }
  }, [stepIdx, stepCube])

  const playAll = () => {
    if (busy) return
    setBusy(true)
    setCube(newCube())
    setStepIdx(0)
    queueRef.current = [...moves]
    const first = queueRef.current.shift()!
    setCube(stepCube(1))
    setStepIdx(1)
    setPendingMove(first)
  }

  const playNext = () => {
    if (busy || stepIdx >= moves.length) return
    setBusy(true)
    const nextIdx = stepIdx + 1
    setCube(stepCube(nextIdx))
    setStepIdx(nextIdx)
    setPendingMove(moves[stepIdx])
  }

  const playPrev = () => {
    if (busy || stepIdx === 0) return
    const nextIdx = stepIdx - 1
    setCube(stepCube(nextIdx))
    setStepIdx(nextIdx)
  }

  const reset = () => {
    setCube(newCube())
    setStepIdx(0)
    setPendingMove(null)
    setBusy(false)
    queueRef.current = []
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
          stickerString={getStickerString(cube)}
          pendingMove={pendingMove}
          onMoveApplied={onAnimationDone}
          height={280}
          showControls={false}
        />
        <div className="space-y-2">
          <MiniCube2D stickerString={getStickerString(cube)} />
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
            <MoveStepper key={algo.name} algorithm={algo} expanded={false} />
          ))}
        </section>
      ))}
    </div>
  )
}
