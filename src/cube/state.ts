// Thin wrapper around cubejs for type-safe, ergonomic access.

import Cube from 'cubejs'

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B'

export interface CubeModel {
  raw: Cube
}

export function newCube(): CubeModel {
  return { raw: new Cube() }
}

export function solvedCube(): CubeModel {
  return { raw: new Cube() }
}

export function cloneCube(c: CubeModel): CubeModel {
  return { raw: Cube.fromString(c.raw.asString()) }
}

export function isSolved(c: CubeModel): boolean {
  return c.raw.isSolved()
}

export function applyMove(c: CubeModel, move: string): CubeModel {
  c.raw.move(move)
  return c
}

export function applyMoves(c: CubeModel, moves: string): CubeModel {
  c.raw.move(moves)
  return c
}

export function invertMoveToken(m: string): string {
  if (m.endsWith("'")) return m.slice(0, -1)
  if (m.endsWith('2')) return m
  return m + "'"
}

export function invertMoves(notation: string): string {
  return notation.trim().split(/\s+/).filter(Boolean).reverse().map(invertMoveToken).join(' ')
}

export function parseMoves(notation: string): string[] {
  return notation.trim().split(/\s+/).filter(Boolean)
}

export function getStickerString(c: CubeModel): string {
  return c.raw.asString()
}

export function fromStickerString(str: string): CubeModel {
  return { raw: Cube.fromString(str) }
}

export const FACE_ORDER: Face[] = ['U', 'R', 'F', 'D', 'L', 'B']

export function faceOf(c: CubeModel | string, face: Face): string {
  const s = typeof c === 'string' ? c : getStickerString(c)
  const i = FACE_ORDER.indexOf(face)
  return s.slice(i * 9, i * 9 + 9)
}

export const COLOR_HEX: Record<Face, string> = {
  U: '#f5f5f5',
  D: '#ffd500',
  F: '#009b48',
  B: '#0046ad',
  L: '#ff5900',
  R: '#b71234',
}

export function stickerColor(s: string, face: Face, pos: number): Face {
  const c = faceOf(s, face)
  return c[pos] as Face
}
