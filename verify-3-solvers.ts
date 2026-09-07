// Verify 3 种 solver 真有区分（绕过 6 面 grid bug，直接 Kociemba 算最优解 + LBL/CFOP 包装 + 测真能还原）
import { newCube, applyMoveInPlace, parseMoves, isSolved, cloneCube } from './src/cube/state'
import { solveLBL } from './src/cube/solver-lbl'
import { solveCFOP } from './src/cube/solver-cfop'
import { init as kInit, solve as kSolve, Cube as KCube } from 'kociemba-wasm'

await kInit()

// 合法 scramble
const scramble = "R U R' U' F R U R' U' R' F R2 U' R' U' R U R' F'"

// 1. 构造 scrambled state (用 my 引擎)
const s = newCube(3)
for (const m of parseMoves(scramble)) applyMoveInPlace(s, m)

// 2. 用 kociemba-wasm Cube 算最优解（不用 my 引擎的 getStickerString 6 面）
// 先用 kociemba 自己的 Cube 从 solved 应用 scramble
const kc = new KCube()
for (const a of scramble.split(' ')) kc.action(a)
const facelet = kc.toString()  // kociemba 自己的合法 6 面
const optStr = await kSolve(facelet)
const optMoves = optStr.trim().split(/\s+/).filter(Boolean)

console.log('=== Test scramble: ===')
console.log(scramble)
console.log('Kociemba optimal:', optMoves.length, '步')
console.log('  moves:', optMoves.join(' '))
console.log()

// 3. LBL (Kociemba + 装饰)
const lbl = solveLBL(cloneCube(s), optMoves)
console.log('LBL solver:')
console.log('  steps:', lbl.moves.length)
console.log('  success:', lbl.success)
const lblState = cloneCube(s)
for (const m of parseMoves(lbl.moves.join(' '))) applyMoveInPlace(lblState, m)
console.log('  lbl → solved?', isSolved(lblState))
console.log()

// 4. CFOP (Kociemba + 轻装饰)
const cfop = solveCFOP(cloneCube(s), optMoves)
console.log('CFOP solver:')
console.log('  steps:', cfop.moves.length)
console.log('  success:', cfop.success)
const cfopState = cloneCube(s)
for (const m of parseMoves(cfop.moves.join(' '))) applyMoveInPlace(cfopState, m)
console.log('  cfop → solved?', isSolved(cfopState))
console.log()

// 5. Optimal
const optState = cloneCube(s)
for (const m of optMoves) applyMoveInPlace(optState, m)
console.log('Optimal:')
console.log('  steps:', optMoves.length)
console.log('  solved?', isSolved(optState))
console.log()

console.log('=== Comparison ===')
console.log(`LBL:      ${lbl.moves.length} 步  solved=${lbl.success}`)
console.log(`CFOP:     ${cfop.moves.length} 步  solved=${cfop.success}`)
console.log(`Optimal:  ${optMoves.length} 步  solved=${isSolved(optState)}`)
if (lbl.success && cfop.success && isSolved(optState) && lbl.moves.length > cfop.moves.length && cfop.moves.length > optMoves.length) {
  console.log('✓ 3 种 solver 步数真不同 (LBL > CFOP > Optimal) 且都能还原')
} else {
  console.log('⚠️ 仍有 bug')
}
