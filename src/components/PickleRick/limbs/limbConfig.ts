// Limb definitions as plain data: names, sockets on the body, segment lengths and rest pose.
// "Left" means screen left (-x), the same convention the face uses for leftEye / leftBrow.
//
// Each limb is a two-segment rubber-hose chain hanging along its socket's local -Y:
//   socket (on the body) > limb root > upper joint (shoulder/hip) > lower joint (elbow/knee) > end (hand/foot)
import { Euler, Vector3 } from 'three'
import { surfacePoint } from '../bodyShape'

export type LimbId = 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg'
export type LimbKind = 'arm' | 'leg'
export const LIMB_IDS: LimbId[] = ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']

/**
 * Joint angles in radians. X: positive swings the segment backward, negative forward.
 * Z: positive swings it outward (away from the body). Z is mirrored by side, so both sides use the same numbers.
 */
export interface JointPose {
  upperX: number
  upperZ: number
  lowerX: number
  lowerZ: number
}

export const SEGMENTS: Record<LimbKind, { upper: number; lower: number; radius: number }> = {
  arm: { upper: 0.42, lower: 0.4, radius: 0.042 }, // long thin noodle arms
  leg: { upper: 0.29, lower: 0.28, radius: 0.05 }, // short spindly legs under a big body
}

export const REST_JOINTS: Record<LimbKind, JointPose> = {
  arm: { upperX: -0.12, upperZ: 0, lowerX: -0.3, lowerZ: -0.4 }, // forearm bent forward and back in
  leg: { upperX: -0.22, upperZ: 0, lowerX: 0.38, lowerZ: 0 }, // knees slightly forward
}

// Where the sockets sit on the body. phi = angle around the body (0 = front), splay = outward tilt.
const SOCKET_PLACEMENT: Record<LimbKind, { y: number; phi: number; inset: number; splay: number }> = {
  arm: { y: -0.08, phi: 1.5, inset: 0.035, splay: 0.7 },
  leg: { y: -1.2, phi: 0.9, inset: 0.05, splay: 0.12 },
}

// Foot shape (used by the mesh and to find the ground).
export const FOOT = { radius: 0.085, scale: [0.95, 0.55, 1.7] as [number, number, number], drop: 0.03, forward: 0.07 }

export interface LimbDef {
  id: LimbId
  kind: LimbKind
  /** -1 = screen left, +1 = screen right. */
  side: -1 | 1
  /** Scene-graph name of the limb object. */
  partName: 'ArmLeft' | 'ArmRight' | 'LegLeft' | 'LegRight'
  /** Scene-graph name of the socket on the body. */
  socketName: 'LeftArmSocket' | 'RightArmSocket' | 'LeftLegSocket' | 'RightLegSocket'
  /** Socket transform in body (torso) space: where the limb attaches and which way it hangs. */
  socket: { position: [number, number, number]; rotation: [number, number, number] }
}

function limb(id: LimbId, kind: LimbKind, side: -1 | 1, partName: LimbDef['partName'], socketName: LimbDef['socketName']): LimbDef {
  const p = SOCKET_PLACEMENT[kind]
  return {
    id, kind, side, partName, socketName,
    socket: { position: surfacePoint(p.y, side * p.phi, p.inset), rotation: [0, 0, side * p.splay] },
  }
}

export const LIMBS: Record<LimbId, LimbDef> = {
  leftArm: limb('leftArm', 'arm', -1, 'ArmLeft', 'LeftArmSocket'),
  rightArm: limb('rightArm', 'arm', 1, 'ArmRight', 'RightArmSocket'),
  leftLeg: limb('leftLeg', 'leg', -1, 'LegLeft', 'LeftLegSocket'),
  rightLeg: limb('rightLeg', 'leg', 1, 'LegRight', 'RightLegSocket'),
}

/**
 * Forward kinematics: socket, elbow/knee and hand/ankle positions in body space for the given joints.
 * Mirrors exactly what the scene graph does. Not used per frame (it allocates), only for setup and tests.
 */
export function limbJointPositions(def: LimbDef, j: JointPose) {
  const { upper, lower } = SEGMENTS[def.kind]
  const socketRotation = new Euler(...def.socket.rotation)
  const upperRotation = new Euler(j.upperX, 0, def.side * j.upperZ)
  const lowerRotation = new Euler(j.lowerX, 0, def.side * j.lowerZ)
  const origin = new Vector3(...def.socket.position)
  const toBody = (v: Vector3) => v.applyEuler(socketRotation).add(origin)
  const middle = toBody(new Vector3(0, -upper, 0).applyEuler(upperRotation))
  const end = toBody(new Vector3(0, -lower, 0).applyEuler(lowerRotation).add(new Vector3(0, -upper, 0)).applyEuler(upperRotation))
  return { root: origin, middle, end }
}

/** Height of the ground: the bottom of the feet in the rest pose. */
export const GROUND_Y =
  Math.min(...(['leftLeg', 'rightLeg'] as const).map((id) => limbJointPositions(LIMBS[id], REST_JOINTS.leg).end.y)) -
  FOOT.drop - FOOT.radius * FOOT.scale[1]
