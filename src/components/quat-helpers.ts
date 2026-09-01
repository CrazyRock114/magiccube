// Helper for 3D rendering: rotate a default +Z plane to face a given normal.

import type { Quat, Vec3 } from '../cube/quat'

export function quatPlaneToNormal(n: Vec3): Quat {
  const [nx, ny, nz] = n
  if (nz > 0.9999) return [0, 0, 0, 1]
  if (nz < -0.9999) return [1, 0, 0, 0]  // 180° around X
  const len = Math.sqrt(nx * nx + ny * ny)
  const ax = -ny / len
  const ay = nx / len
  const az = 0
  const angle = Math.acos(nz)
  const s = Math.sin(angle / 2)
  return [ax * s, ay * s, az * s, Math.cos(angle / 2)]
}
