// 完整还原教程：从入门到最短路径研究
//
// 四个阶段：
//   1. 初级 — LBL (Layer by Layer)：7 步白底法，~4 个算法，平均 ~120 步
//   2. 中级 — 2-look CFOP：把 OLL/PLL 各拆成 2 步，~10 个算法，~60 步
//   3. 高级 — Full CFOP：完整 78 个 OLL+PLL 公式，~55 步
//   4. 研究 — 最短路径：God's Number = 20，Kociemba 两阶段算法
//
// 每步设计：目标 + 关键算法 + 常见错误 + 互动演示（看具体状态）

import { useState, useRef, useCallback, useMemo } from 'react'
import { Cube3D, MiniCube2D } from '../components/Cube3D'
import { InteractiveStepCard } from '../components/InteractiveStepCard'
import { newCube, applyMoveInPlace, cloneCube, isSolved, parseMoves } from '../cube/state'
import { CubeState } from '../cube/state'
import {
  checkWhiteCross, checkFirstLayer, checkSecondLayer, checkTopCross,
  checkTopFace, checkCornersPermuted, checkSolved,
} from '../cube/solveCheck'

// ==================== 工具 ====================

function makeScrambled(seed: number, length = 20): CubeState {
  // 用 seed 做伪随机 scramble（保证可复现）
  const c = newCube(3)
  const moves = ['U', 'D', 'R', 'L', 'F', 'B', "U'", "D'", "R'", "L'", "F'", "B'"]
  let last = -1
  let s = seed
  for (let i = 0; i < length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    let m = moves[s % moves.length]
    let face = m[0]
    // 不要连续转同面
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

function moveCount(s: CubeState): number {
  // 估算步数：cubies 数量 - 26 (3x3 solved 是 26 cubies)
  return Math.max(0, s.cubies.length - 26)
}

function DifficultyBadge({ level, color }: { level: string; color: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold"
      style={{ backgroundColor: color, color: '#0a0a14' }}
    >
      {level}
    </span>
  )
}

// ==================== 互动演示组件 ====================

function StepDemo({ initialState, demoMoves }: { initialState?: CubeState; demoMoves?: string[] }) {
  // 演示某个状态或应用一系列 move 的过程
  const [state, setState] = useState<CubeState>(() => initialState ?? makeScrambled(42, 15))
  const [pendingMove, setPendingMove] = useState<string | null>(null)
  const currentMoveRef = useRef<string | null>(null)

  const onMoveApplied = useCallback(() => {
    const finished = currentMoveRef.current
    if (finished) {
      setState(c => {
        const nc = cloneCube(c)
        applyMoveInPlace(nc, finished)
        return nc
      })
    }
    currentMoveRef.current = null
    setPendingMove(null)
  }, [])

  const playMove = (m: string) => {
    currentMoveRef.current = m
    setPendingMove(m)
  }

  const reset = (newState: CubeState) => {
    setState(newState)
    setPendingMove(null)
    currentMoveRef.current = null
  }

  const doScramble = () => {
    const s = makeScrambled(Math.floor(Math.random() * 10000), 18)
    reset(s)
  }

  const doDemoSequence = async () => {
    if (!demoMoves) return
    const moves = parseMoves(demoMoves.join(' '))
    for (const m of moves) {
      playMove(m)
      // 等待动画（400ms 一次 move）
      await new Promise(r => setTimeout(r, 450))
    }
  }

  return (
    <div className="card bg-cube-bg/30">
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <Cube3D
            state={state}
            pendingMove={pendingMove}
            onMoveApplied={onMoveApplied}
            height={280}
          />
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-mono text-cube-muted text-xs">
            {pendingMove ? `应用中: ${pendingMove}` : '（待命）'}
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={doScramble} className="btn text-xs">🎲 打乱</button>
            {demoMoves && (
              <button onClick={doDemoSequence} className="btn text-xs">▶ 播放演示</button>
            )}
            <button onClick={() => reset(initialState ?? newCube(3))} className="btn text-xs">↺ 重置</button>
          </div>
          <div className="mt-3">
            <MiniCube2D state={state} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== 内容 section 组件 ====================

function SectionTitle({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-4xl font-mono font-bold text-cube-accent">{num}</span>
        <h2 className="h2 flex-1">{title}</h2>
      </div>
      {subtitle && <p className="text-cube-muted">{subtitle}</p>}
    </header>
  )
}

function StepCard({
  step,
  title,
  goal,
  algorithm,
  tips,
  warnings,
}: {
  step: string
  title: string
  goal: string
  algorithm?: { name: string; notation: string; when?: string }
  tips?: string[]
  warnings?: string[]
}) {
  return (
    <div className="card mb-4">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono font-bold text-cube-accent text-lg">{step}</span>
        <h3 className="text-xl font-semibold flex-1">{title}</h3>
      </div>
      <div className="text-sm text-cube-text/90 leading-relaxed mb-3">
        <span className="text-cube-muted">目标：</span>{goal}
      </div>
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
    </div>
  )
}

// ==================== 阶段一：LBL（入门）====================

interface LBLSpec {
  stepNumber: number
  title: string
  goal: string
  hint: string
  checker: (state: CubeState) => boolean
  seed: number
  algorithm?: { name: string; notation: string; when?: string }
  tips?: string[]
  warnings?: string[]
}

// 7 步定义：每步的标题、目标、提示、检测函数、scramble seed
const LBL_STEPS: LBLSpec[] = [
  {
    stepNumber: 1,
    title: '底层十字 (Down Cross)',
    goal: '把 4 个含白面的棱块放到 D 层，白色面朝下。',
    hint: 'D 面 4 个 edge sticker 全是白色（朝下）',
    checker: checkWhiteCross,
    seed: 1001,
    tips: [
      '不需要公式 — 全靠手感和预判。挑一个白棱，先把它的白色转到 D 面，再调整它的"另一面颜色"跟相邻中心块匹配。',
      '每放一个白棱，其他已经放好的会被打乱 — 这是正常的。',
    ],
    warnings: [
      '新手常见：先看 U 面再绕。改习惯：永远先在 U 面找一个白棱，跟着白色面走。',
    ],
  },
  {
    stepNumber: 2,
    title: '底层角块 (Down Corners)',
    goal: '把 4 个含白面的角块放到 D 层 4 个角上，白面朝下。',
    hint: 'D 面 9 个 sticker 全是白色',
    checker: checkFirstLayer,
    seed: 1002,
    algorithm: {
      name: '右下角换位 (R\' D\' R D)',
      notation: "R' D' R D",
      when: 'D 层角块在 D 层但位置错（白色在右面或前面）',
    },
    tips: [
      '算法叫 "right-hand trigger"，练熟了所有 LBL 步骤都用它。',
      '做法：找 D 层一个含白棱块的角，白色不在 D 面 → 把它转到 R-U-F 角 → 重复 R\' D\' R D 直到白色朝下。',
    ],
    warnings: [
      'D 转动时 D 层会跟着转，但不影响 R\' D\' R D 算法逻辑 — D 是算法的"传送带"。',
    ],
  },
  {
    stepNumber: 3,
    title: '第二层棱块 (Second Layer Edges)',
    goal: '把 4 个不含黄色的中层棱块插入中层，每块两侧颜色匹配相邻中心块。',
    hint: '4 个中层 edge 都在中层且颜色匹配',
    checker: checkSecondLayer,
    seed: 1003,
    algorithm: {
      name: '右侧插入 (U R U\' R\' U\' F\' U F)',
      notation: "U R U' R' U' F' U F",
      when: '顶层有一个非黄棱块要插到右侧。镜像版用于左侧。',
    },
    tips: [
      '这一步骤对新手最难 — 因为它需要"先选边、再选面"。',
      '做之前：先转 U 把目标棱块的颜色（不是黄的）放到中心块匹配的位置。然后看棱块的另一个面是朝 R 还是 L。',
      '如果找不到匹配的颜色对（顶层只剩含黄棱块），跳到 Step 4 — OLL 时会把它弄出来。',
    ],
    warnings: [
      '常见错误：选了黄棱块做这一步 — 黄棱块是顶面的，不属于中层。',
    ],
  },
  {
    stepNumber: 4,
    title: '顶面十字 (Top Cross)',
    goal: '把 U 面 4 个棱块转成黄色（让它们形成十字形 — 中心黄 + 4 棱黄）。',
    hint: 'U 面 4 个 edge sticker 全是黄色',
    checker: checkTopCross,
    seed: 1004,
    algorithm: {
      name: 'F R U R\' U\' F\' (Fruruf)',
      notation: "F R U R' U' F'",
      when: '没有 yellow cross：U 面一个黄棱都没有、或只有 1 个、或只有 1 条线',
    },
    tips: [
      '7 种 U 棱朝向分 3 类：点（0 黄）、L（2 黄相邻）、线（2 黄对角）。',
      '点 → 1 次 Fruruf 变 L，L → 1 次 Fruruf 变线，线 → 1 次 Fruruf 变十字。',
    ],
    warnings: [
      '不要用 4 步 R U R\' U\' — 那只能转 90° 棱块、不能从点变 L。',
    ],
  },
  {
    stepNumber: 5,
    title: '顶面定向 (2-Look OLL: Orient Last Layer)',
    goal: '让 U 面 9 个块全部变黄（包括中心和角）。',
    hint: 'U 面 9 个 sticker 全是黄色',
    checker: checkTopFace,
    seed: 1005,
    algorithm: {
      name: 'Sune (R U R\' U R U2 R\')',
      notation: "R U R' U R U2 R'",
      when: 'Sune：U 面 1 个角黄、3 个不是（"鱼形"）。Anti-Sune 镜像。',
    },
    tips: [
      '2-Look OLL = 2 步：先做十字（4 个棱都对 — Step 4 已搞定），再做角。',
      '7 种角朝向 = 2 类：Sune 系（3 个）+ Anti-Sune 系（3 个）+ 已好（1 个）。',
    ],
    warnings: [
      'Sune 用错方向会破坏十字。如果转完后十字没了，从 Step 4 重新来。',
    ],
  },
  {
    stepNumber: 6,
    title: '顶层角块定位 (2-Look PLL: Permute Last Layer, Corners)',
    goal: '让 4 个顶层角块各自回到正确位置（颜色跟 3 个中心都对齐）。',
    hint: '4 个顶层角位置+朝向都对',
    checker: checkCornersPermuted,
    seed: 1006,
    algorithm: {
      name: 'T-perm (R U R\' U\' R\' F R2 U\' R\' U\' R U R\' F\')',
      notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
      when: '对角 2 个角需要互换（"对角"或"相邻"对换）',
    },
    tips: [
      '7 种角置换 = 2 类：A-perm 系（对角 3-cycle）+ T-perm（对角 2-swap）。',
      'T-perm 自反 — T T = I。',
    ],
    warnings: [
      'A-perm 和 T-perm 容易记混 — 多练几次找感觉。',
    ],
  },
  {
    stepNumber: 7,
    title: '顶层棱块定位 (2-Look PLL: Edges)',
    goal: '让顶层 4 个棱块回到正确位置，魔方完成！',
    hint: '整魔方还原（solved）',
    checker: checkSolved,
    seed: 1007,
    algorithm: {
      name: 'U-perm (R U\' R U R U R U\' R\' U\' R2)',
      notation: "R U' R U R U R U' R' U' R2",
      when: '3 棱 3-cycle（"三棱循环"）。镜像版用于反方向。',
    },
    tips: [
      '4 种棱置换 = 3 类：E-perm（对侧 2-swap）、U-perm（3-cycle CW）、U-perm\'（3-cycle CCW）、H-perm（对侧 2-swap）。',
      '做完 Sune/T-perm 之后做 U-perm — 这是经典的 2-look PLL 套路。',
    ],
    warnings: [
      'U-perm 和 U-perm 镜像容易弄错 — 关键是看 3-cycle 的方向。',
    ],
  },
]

function BeginnerSection() {
  // 7 步解锁链：完成第 N 步 → 解锁第 N+1 步
  const [completed, setCompleted] = useState<Set<number>>(() => new Set([0]))  // Step 1 永远解锁
  const completedCount = completed.size - 1  // 减去初始的 0（"已解锁 Step 1"）
  const allDone = completedCount === LBL_STEPS.length

  return (
    <section>
      <SectionTitle
        num="01"
        title="入门 — LBL 层先法"
        subtitle="~4 个公式，平均 100-150 步还原。学完这一步你能解任何 3×3。"
      />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DifficultyBadge level="入门" color="#10b981" />
        <span className="text-xs text-cube-muted">适合：刚学完记号、想解第一个魔方</span>
      </div>
      <p className="text-sm text-cube-text/90 leading-relaxed mb-4">
        LBL（Layer By Layer）是最古老也最直觉的方法。核心思路是"一层一层解"——
        先做底面十字，再放 4 个底面角，然后放第二层 4 个棱块，最后做顶面。
        7 步，每步目标单一，不需要"先看后面会怎样"。代价是步数多，但每个步骤都能用"几个常用算法"搞定。
      </p>

      {/* 进度条 + 解锁提示 */}
      <div className="card bg-cube-bg/40 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold">学习进度</span>
          <span className="pill-move bg-cube-accent text-cube-bg">{completedCount} / {LBL_STEPS.length}</span>
          {allDone && <span className="pill-move bg-green-500 text-white">🎉 LBL 已掌握</span>}
        </div>
        <div className="w-full h-2 bg-cube-bg rounded overflow-hidden">
          <div
            className="h-full bg-cube-accent transition-all duration-500"
            style={{ width: `${(completedCount / LBL_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="text-xs text-cube-muted mt-2">
          每张互动卡下面有独立的迷你魔方 + 18 个公式按钮 + 撤销/重置。达成当前步目标后，下一步自动解锁。
        </div>
      </div>

      {/* 7 个互动步骤 */}
      {LBL_STEPS.map((s, i) => (
        <div key={s.stepNumber} className="space-y-2">
          <InteractiveStepCard
            stepNumber={s.stepNumber}
            title={s.title}
            goal={s.goal}
            hint={s.hint}
            checker={s.checker}
            scrambleSeed={s.seed}
            locked={s.stepNumber > 1 && !completed.has(s.stepNumber - 1)}
            completed={completed.has(s.stepNumber)}
            onComplete={() => setCompleted((prev) => {
              const next = new Set(prev)
              next.add(s.stepNumber)
              return next
            })}
          />
          {/* 步骤下方技巧/警告/算法提示（达成后才显示，作为参考） */}
          {completed.has(s.stepNumber) && (s.tips || s.warnings || s.algorithm) && (
            <div className="ml-4 mb-4 text-sm space-y-2 border-l-2 border-cube-accent/40 pl-4">
              {s.algorithm && (
                <div className="bg-cube-bg px-3 py-2 font-mono">
                  <div className="text-cube-muted text-xs mb-1">关键公式</div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold">{s.algorithm.name}</span>
                    <span className="text-cube-accent">{s.algorithm.notation}</span>
                  </div>
                  {s.algorithm.when && <div className="text-xs text-cube-muted mt-1">使用时机：{s.algorithm.when}</div>}
                </div>
              )}
              {s.tips && s.tips.length > 0 && (
                <div className="text-cube-text/80">
                  <div className="text-cube-muted text-xs mb-1">💡 技巧</div>
                  <ul className="list-disc ml-5 space-y-1">{s.tips.map((t, j) => <li key={j}>{t}</li>)}</ul>
                </div>
              )}
              {s.warnings && s.warnings.length > 0 && (
                <div className="text-cube-text/80">
                  <div className="text-red-300 text-xs mb-1">⚠️ 常见错误</div>
                  <ul className="list-disc ml-5 space-y-1">{s.warnings.map((w, j) => <li key={j}>{w}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* 完成全部 7 步的祝贺卡 */}
      {allDone && (
        <div className="card bg-gradient-to-r from-green-500/10 to-cube-accent/15 border-l-4 border-green-500 mt-6">
          <div className="font-semibold mb-2 text-lg">🎉 恭喜！LBL 7 步全部完成</div>
          <div className="text-sm space-y-1">
            <div>你已经走完了 3×3 还原的<b>完整入门流程</b>。</div>
            <div className="text-cube-muted mt-2">
              接下来：<b>阶段二 · 2-Look CFOP</b> 教你把 OLL/PLL 各拆 2 段，平均步数砍半到 ~60 步。
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ==================== 阶段二：2-look CFOP（中级）====================

function IntermediateSection() {
  return (
    <section>
      <SectionTitle
        num="02"
        title="中级 — 2-Look CFOP"
        subtitle="~10 个公式，~50-80 步还原。从 LBL 升级的关键是把 OLL/PLL 各拆成 2 步。"
      />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DifficultyBadge level="中级" color="#3b82f6" />
        <span className="text-xs text-cube-muted">适合：LBL 流畅后想提速</span>
      </div>
      <p className="text-sm text-cube-text/90 leading-relaxed mb-6">
        入门 LBL 用 4 个公式但每步都是独立的"局部操作"。中级 2-look CFOP
        的关键改进：把"先做十字再做角"的 OLL 拆成"2 段"（先所有棱，再所有角），
        把 PLL 也拆成"2 段"（先角后棱）。这样你可以用一套"edge-only"或"corner-only"的算法，
        公式总数翻倍（10 个）但平均步数砍半（因为减少了"调来调去找正确状态"的步数）。
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">2-Look OLL：把顶面做黄</h3>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-4">
        <b>第一段：棱定向（Edge Orientation）</b> — 让 U 面的 4 个棱黄色朝上。
        7 种棱朝向分 2 类 — "点/线/L"（0/2/2 黄棱） → 用 Fruruf 转成十字。
      </p>
      <StepCard
        step="OLL-A"
        title="2-Look OLL 棱部分"
        goal="把 4 个顶棱都变黄（U 面是黄色十字，但角可能还不是黄）"
        algorithm={{
          name: 'Fruruf (F R U R\' U\' F\')',
          notation: "F R U R' U' F'",
          when: '0/1/2 个黄棱。3 个黄棱（线）1 次就出十字。',
        }}
        tips={[
          '做完后一定看到黄色十字在 U 面，但 4 个角的角块可能还是其他颜色。',
        ]}
      />
      <StepCard
        step="OLL-B"
        title="2-Look OLL 角部分"
        goal="把 4 个顶角都变黄（U 面整面黄）"
        algorithm={{
          name: 'Sune 系 + Anti-Sune 系',
          notation: 'R U R\' U R U2 R\'  /  L\' U\' L U\' L\' U2 L',
          when: '7 种角朝向分 2 类 — 3 个 Sune、3 个 Anti-Sune、1 个已好',
        }}
        tips={[
          '现在 U 面已经十字了，剩下就是 Sune / Anti-Sune。',
          '判断 Sune 还是 Anti-Sune：看哪个角是"鱼头"（3 黄的角）。',
        ]}
      />

      <h3 className="text-xl font-semibold mt-6 mb-3">2-Look PLL：把顶层对位</h3>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-4">
        <b>第一段：角定位（Corner Permutation）</b> — 让 4 个顶角都到正确位置（颜色对，但棱不一定对）。
      </p>
      <StepCard
        step="PLL-A"
        title="2-Look PLL 角部分"
        goal="4 个顶角到正确位置（哪怕朝向还差）"
        algorithm={{
          name: 'T-perm (对角 2-swap) + A-perm (3-cycle)',
          notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
          when: '对角 2 个角需要互换 → T-perm。相邻 3-cycle → A-perm。',
        }}
        tips={[
          'T-perm 自反，做一次 T-perm 完事。A-perm 不自反，要做 3 次（或 A-perm + 镜像 A-perm）。',
          '做完角部分：4 个角位都对，但 4 个棱位可能错（包括 0/1/2/4 个对位）。',
        ]}
      />
      <StepCard
        step="PLL-B"
        title="2-Look PLL 棱部分"
        goal="4 个顶棱到正确位置（魔方解完）"
        algorithm={{
          name: 'U-perm / U-perm\' + E-perm / H-perm',
          notation: "R U' R U R U R U' R' U' R2",
          when: '3-cycle → U-perm。对侧 2-swap → E-perm 或 H-perm。',
        }}
        tips={[
          'E-perm 和 H-perm 是对侧换棱，区别在左右方向。',
        ]}
      />

      <div className="card bg-cube-accent/10 border-l-4 border-cube-accent mt-6">
        <div className="font-semibold mb-2">⚡ 2-Look CFOP 完整流程</div>
        <div className="text-sm space-y-1">
          <div>1. <b>Cross</b>（4 棱 → D 层匹配中心）</div>
          <div>2. <b>F2L 4 对</b>（每对 = 1 棱 + 1 角，先 pair 后 insert）</div>
          <div>3. <b>2-Look OLL</b>：Fruruf → 十字 → Sune 系 → 全黄</div>
          <div>4. <b>2-Look PLL</b>：T/A-perm → 角对位 → U/E/H-perm → 棱对位</div>
        </div>
        <div className="mt-3 text-xs text-cube-muted">
          公式总数 ~10 个（OLL 3 + PLL 4 + F2L 3 类基本模式），比 LBL 多但平均步数减半。
        </div>
      </div>
    </section>
  )
}

// ==================== 阶段三：Full CFOP（高级）====================

function AdvancedSection() {
  return (
    <section>
      <SectionTitle
        num="03"
        title="高级 — Full CFOP"
        subtitle="~78 个 OLL+PLL 公式，~55 步还原。配合 finger tricks 和 look-ahead，sub-15 秒可达。"
      />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DifficultyBadge level="高级" color="#a855f7" />
        <span className="text-xs text-cube-muted">适合：2-look CFOP 流畅（sub-30s）后想再提速</span>
      </div>
      <p className="text-sm text-cube-text/90 leading-relaxed mb-6">
        Full CFOP 跟 2-look 的核心区别：OLL 不再分 2 段（先棱后角），而是一次性把所有角 + 棱都定好。
        这意味着你不需要先做十字再做角，可以直接用一个公式把顶面做黄。
        PLL 也是一次性把角 + 棱都对位，不需要先角后棱。
        代价：公式数量从 10 暴涨到 78（OLL 57 + PLL 21）。
        但每个公式都是 1-look — 看到状态就能直接做对应公式，不用先做边角。
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">Cross：完全预判（Look-ahead Cross）</h3>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li>在 <b>Inspection 时间（15s）</b> 里就要解完整个十字 — 看哪些棱需要动、用什么 move 序列。</li>
        <li>8-move 十字是平均线。高手 sub-15s 的选手通常 6-move 十字。</li>
        <li>关键：拼出"低 move 数"路径 — 后两步常常可以合并（不是机械地 4 个 F2L 解完再上 4 个 OLL）。</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">F2L：4 对 corner-edge 同时解</h3>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li>从 2-look 的"先 pair 再 insert"升级到"边解下一对、眼看下两对"。</li>
        <li><b>Look-ahead</b>：在做当前 F2L 最后一对时，眼睛已经在看下一对的位置。</li>
        <li>F2L 有 ~41 个标准情况（intuitive + algorithm）。熟手可以纯直觉解（不背公式）。</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">1-Look OLL：57 个全黄面</h3>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-3">
        57 个 OLL 公式按"形状"分组：
      </p>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li><b>点 (P) / 十字 (C) / L (W)</b> — 10 个，全是 OLL 棱部分</li>
        <li><b>Sune 系 (S)</b> — 11 个（含 Sune、Anti-Sune、Bowtie 等）</li>
        <li><b>T / U / L / H / pi / T 形</b> — 36 个，剩余形状</li>
        <li>每个 OLL 都有专门的算法，平均 ~10 步。背 57 个公式看似多，但每类形状的"识别"只需要 0.5 秒（视觉 pattern matching）。</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">1-Look PLL：21 个全对位</h3>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-3">
        21 个 PLL 公式按置换分两组：
      </p>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li><b>角置换 (Corner-only)：A-perm、Ua-perm、Ub-perm、H-perm、Z-perm、Ja/Jb、T-perm、E-perm、F-perm、Rb-perm、Ra-perm、Na/Nb-perm、V-perm、Y-perm</b> — 13 个，影响角</li>
        <li><b>棱置换 (Edge-only)：U-perm、H-perm、Z-perm (双层)</b> — 2-3 个</li>
        <li><b>角 + 棱 同时：T/Y/F/R/G/N/V-perm</b> — 8 个</li>
        <li>每个 PLL ~15-20 步。2-look PLL 平均 ~25 步，1-look ~17 步。</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">Finger tricks & 提速</h3>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li><b>右手 R/U</b> 用食指推（不整个握），左手 L/D 同理。</li>
        <li><b>双层 (r/U)</b> 用 M 同步或 push 食指。</li>
        <li><b>转体</b>：F\' B\' 这种"对侧转"应该用 U/y 切体然后做 R/L — 节省手部动作。</li>
        <li><b>Last Layer Aiming</b>：OLL/PLL 前先用 U/U\' 把"目标状态"转到正面（最常用 Sune 朝前做）。</li>
      </ul>
    </section>
  )
}

// ==================== 阶段四：最短路径研究 ====================

function ResearchSection() {
  return (
    <section>
      <SectionTitle
        num="04"
        title="研究 — 最短路径与 God's Number"
        subtitle="不只是“会解”，而是“最少步数解”。Cube 群论 + BFS + Kociemba 两阶段算法的世界。"
      />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <DifficultyBadge level="研究" color="#ef4444" />
        <span className="text-xs text-cube-muted">适合：想知道为什么 CFOP 只能 ~55 步而不是 20 步</span>
      </div>

      <h3 className="text-xl font-semibold mt-6 mb-3">God's Number = 20</h3>
      <p className="text-sm text-cube-text/90 leading-relaxed mb-4">
        2010 年，Tomas Rokicki、Herbert Kociemba、Morley Davidson 和 John Dethridge
        用大规模并行计算机证明了一个数学事实：
        <b className="text-cube-accent">任何 3×3 魔方的随机状态都可以在 20 步（face-turn metric, FTM）内还原</b>。
        这就是"God's Number" = 20。
      </p>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-6">
        也就是说：你手里的魔方，无论多乱，理论上存在一种 ≤ 20 步的解法。
        CFOP 平均 ~55 步，差距来自"cross 浪费步 + F2L 不够优化 + 1-look OLL/PLL 平均步数多"。
        真正接近 God's Number 的算法是 Kociemba 的两阶段求解器（Twophase）。
      </p>

      <h3 className="text-xl font-semibold mt-6 mb-3">QTM vs FTM vs STM 步数</h3>
      <table className="w-full text-sm mb-6">
        <thead className="text-cube-muted text-xs">
          <tr>
            <th className="text-left p-2">指标</th>
            <th className="text-left p-2">说明</th>
            <th className="text-left p-2">God's Number</th>
          </tr>
        </thead>
        <tbody className="font-mono text-cube-text/90">
          <tr className="border-t border-cube-border">
            <td className="p-2">QTM</td>
            <td className="p-2">Quarter-Turn Metric（只算 90° / 180°，180° = 2）</td>
            <td className="p-2">26</td>
          </tr>
          <tr className="border-t border-cube-border">
            <td className="p-2">FTM</td>
            <td className="p-2">Face-Turn Metric（90° = 1，180° = 1，slice = 2）</td>
            <td className="p-2">20</td>
          </tr>
          <tr className="border-t border-cube-border">
            <td className="p-2">STM</td>
            <td className="p-2">Slice-Turn Metric（90° = 1，slice = 1）</td>
            <td className="p-2">18</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-xl font-semibold mt-6 mb-3">BFS / IDA* 在 Cube 群上的应用</h3>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-4">
        3×3 魔方有 4.3 × 10¹⁹ 个状态（43 quintillion）— 直接 BFS 不可能。
        实际操作里：
      </p>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li><b>小子群 BFS</b>：在 H 群（edge 组）或某些小子群里 BFS 到 depth 10-11（处理 cross）</li>
        <li><b>IDA*</b>：迭代加深 A*，用 admissible 启发函数（实际 cube solver 用的最多）</li>
        <li><b>双向 BFS</b>：从初始态和 goal 同时搜，相遇时停止</li>
        <li><b>Pattern database</b>：预计算 corner 群（~88M 状态）的最短路径，作为启发</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">Kociemba 两阶段算法（最实用）</h3>
      <p className="text-sm text-cube-text/80 leading-relaxed mb-3">
        1992 年 Herbert Kociemba 提出的方法，平均 ~20 步解任意状态（接近 God's Number）。
        核心思想：
      </p>
      <ol className="text-sm space-y-2 list-decimal ml-5 mb-6">
        <li><b>阶段一</b>：把 cube 转到 G1 子群（所有角 + 中层棱 (M-slice) 都对位）。用 IDA* 在 G1 子群里搜。</li>
        <li><b>阶段二</b>：在 G1 子群内做（subgroup search），每个 phase 2 搜索对应 15-18 步。</li>
        <li>两阶段合并 ~20 步 — 通常 17-19 步。</li>
        <li>实现：Cube Explorer（Windows 经典）、cubing.js 内置的 Twophase solver、网上的很多 cube solver 网站后端。</li>
      </ol>

      <h3 className="text-xl font-semibold mt-6 mb-3">实际工具</h3>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li><b>Cube Explorer</b>（Kociemba 本人写的 Windows 软件）：最优解 + 详细讲解</li>
        <li><b>alg.cubing.net</b>：在线显示 OLL/PLL 公式</li>
        <li><b>csTimer / Twisty Timer</b>：WCA 风格计时 + 自动 scramble</li>
        <li><b>Optimal Cube Solver</b>：在线 IDA* solver，给出最优解</li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">本教学网站的相关页</h3>
      <ul className="text-sm space-y-2 list-disc ml-5 mb-6">
        <li><a className="text-cube-accent hover:underline" href="/3x3/graph">图论与 Cayley 图</a>：可视化 cube 群结构、每个 move group 的层级</li>
        <li><a className="text-cube-accent hover:underline" href="/3x3/algos">公式 (AlgorithmViz)</a>：上面提到的每个公式的 3D 动画演示</li>
        <li><a className="text-cube-accent hover:underline" href="/3x3">3×3 基础</a>：cross / F2L / OLL / PLL 介绍（短版）</li>
      </ul>
    </section>
  )
}

// ==================== 主组件 ====================

export function Solve() {
  const [activeStage, setActiveStage] = useState<'beginner' | 'intermediate' | 'advanced' | 'research'>('beginner')

  return (
    <div className="space-y-12">
      <header>
        <div className="text-xs text-cube-muted uppercase tracking-widest font-mono">/3x3/solve</div>
        <h1 className="h1">完整还原教程</h1>
        <p className="lead max-w-3xl">
          从入门到最短路径研究。一个随机打乱的 3×3 魔方能用什么步骤还原？
          怎么用最少的公式、最高的效率、最终最少的步数？这里分四段讲清楚。
        </p>
      </header>

      {/* 4 段总览卡片 */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'beginner', num: '01', title: 'LBL 入门', desc: '7 步，4 个公式，~120 步' },
          { id: 'intermediate', num: '02', title: '2-Look CFOP', desc: '~10 公式，~60 步' },
          { id: 'advanced', num: '03', title: 'Full CFOP', desc: '78 公式，~55 步' },
          { id: 'research', num: '04', title: '最短路径', desc: 'God\'s Number = 20' },
        ].map(s => (
          <button
            key={s.id}
            onClick={() => {
              setActiveStage(s.id as any)
              // 滚到对应 section
              setTimeout(() => {
                document.getElementById(`stage-${s.id}`)?.scrollIntoView({ behavior: 'smooth' })
              }, 50)
            }}
            className={`card text-left transition-colors ${
              activeStage === s.id
                ? 'border-cube-accent bg-cube-accent/10'
                : 'hover:border-cube-accent/50'
            }`}
          >
            <div className="text-3xl font-mono font-bold text-cube-accent">{s.num}</div>
            <div className="font-semibold mt-1">{s.title}</div>
            <div className="text-xs text-cube-muted mt-1">{s.desc}</div>
          </button>
        ))}
      </section>

      {/* 当前阶段演示 */}
      <section className="card bg-cube-bg/30">
        <div className="text-xs text-cube-muted uppercase tracking-widest mb-2 font-mono">互动演示</div>
        <h3 className="text-lg font-semibold mb-3">打乱一个魔方 → 看你能做到哪一步</h3>
        <StepDemo />
      </section>

      {/* 各阶段内容 */}
      <div id="stage-beginner"><BeginnerSection /></div>
      <div id="stage-intermediate"><IntermediateSection /></div>
      <div id="stage-advanced"><AdvancedSection /></div>
      <div id="stage-research"><ResearchSection /></div>

      {/* 总结 */}
      <section className="card bg-gradient-to-r from-cube-accent/5 to-cube-accent/15 border-l-4 border-cube-accent">
        <h2 className="h2 mb-3">学习路径总结</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-cube-muted text-xs">
              <tr>
                <th className="text-left p-2">阶段</th>
                <th className="text-left p-2">方法</th>
                <th className="text-left p-2">公式数</th>
                <th className="text-left p-2">平均步数</th>
                <th className="text-left p-2">目标速度</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-cube-border">
                <td className="p-2">入门</td>
                <td className="p-2">LBL (层先法)</td>
                <td className="p-2">4</td>
                <td className="p-2">~120</td>
                <td className="p-2">3-5 min</td>
              </tr>
              <tr className="border-t border-cube-border">
                <td className="p-2">中级</td>
                <td className="p-2">2-Look CFOP</td>
                <td className="p-2">~10</td>
                <td className="p-2">~60</td>
                <td className="p-2">30-60s</td>
              </tr>
              <tr className="border-t border-cube-border">
                <td className="p-2">高级</td>
                <td className="p-2">Full CFOP</td>
                <td className="p-2">~78</td>
                <td className="p-2">~55</td>
                <td className="p-2">sub-15s</td>
              </tr>
              <tr className="border-t border-cube-border">
                <td className="p-2">研究</td>
                <td className="p-2">Kociemba</td>
                <td className="p-2">N/A</td>
                <td className="p-2">~20 (最优)</td>
                <td className="p-2">理论极限</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-cube-muted mt-4">
          CFOP 流程稳态后卡在 ~55 步（cross ~7 + F2L ~30 + OLL ~10 + PLL ~18）。
          离 20 步的理论极限差 ~35 步 — 这就是 Kociemba 两阶段算法
          跟人工 CFOP 的差距来源。要逼近理论极限，必须放弃"按步骤"的思维，
          改成"按子群"的状态机搜索。
        </p>
      </section>
    </div>
  )
}
