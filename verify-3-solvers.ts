// Verify 3 种 solver 真的输出不同步数
import { newCube, applyMoveInPlace, parseMoves, isSolved, cloneCube, getStickerString } from './src/cube/state'
import { solveLBL } from './src/cube/solver-lbl'
import { solveCFOP } from './src/cube/solver-cfop'
import { init as kInit, solve as kSolve } from 'kociemba-wasm'

await kInit()

// 生成一个 scrambled state: 12 步 scramble
const scramble = "R U R' U' F R U R' U' R' F R2 U' R' U' R U R' F'"
const s = newCube(3)
for (const m of parseMoves(scramble)) applyMoveInPlace(s, m)
const sCopy = cloneCube(s)

console.log('=== Test scramble: ===')
console.log(scramble)
console.log('facelet:', getStickerString(s))
console.log()

// LBL
const lbl = solveLBL(cloneCube(s))
console.log('LBL solver:')
console.log('  steps:', lbl.moves.length)
console.log('  success:', lbl.success)
console.log('  stages:', lbl.stages.map(s => `${s.name}(${s.stepCount})`).join(' → '))
// 验证 lbl 真的还原到 solved
const lblState = cloneCube(s)
for (const m of parseMoves(lbl.moves.join(' '))) applyMoveInPlace(lblState, m)
console.log('  lbl → solved?', isSolved(lblState))
console.log()

// CFOP
const cfop = solveCFOP(cloneCube(s))
console.log('CFOP solver:')
console.log('  steps:', cfop.moves.length)
console.log('  success:', cfop.success)
console.log('  stages:', cfop.stages.map(s => `${s.name}(${s.stepCount})`).join(' → '))
const cfopState = cloneCube(s)
for (const m of parseMoves(cfop.moves.join(' '))) applyMoveInPlace(cfopState, m)
console.log('  cfop → solved?', isSolved(cfopState))
console.log()

// Kociemba Optimal
const optStr = await kSolve(getStickerString(s))
const optMoves = optStr.trim().split(/\s+/).filter(Boolean)
console.log('Optimal (Kociemba):')
console.log('  steps:', optMoves.length)
console.log('  moves:', optMoves.join(' '))
const optState = cloneCube(s)
for (const m of parseMoves(optStr)) applyMoveInPlace(optState, m)
console.log('  optimal → solved?', isSolved(optState))
console.log()

console.log('=== Comparison ===')
console.log(`LBL:      ${lbl.moves.length} 步`)
console.log(`CFOP:     ${cfop.moves.length} 步`)
console.log(`Optimal:  ${optMoves.length} 步`)

if (lbl.moves.length === optMoves.length || cfop.moves.length === optMoves.length) {
  console.log('⚠️ 仍有相同步数 — solver 没区分')
} else {
  console.log('✓ 3 种 solver 输出不同步数 — 真有区分')
}
