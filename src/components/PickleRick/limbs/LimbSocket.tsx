// An attachment point on the body (LeftArmSocket, RightArmSocket, LeftLegSocket, RightLegSocket).
// It is a named, empty group at the socket transform from limbConfig; the attached limb renders inside it.
// It lives in the torso group, so it follows breathing, squash and every body motion.
import type { ReactNode } from 'react'
import { LIMBS, type LimbId } from './limbConfig'

export default function LimbSocket({ id, children }: { id: LimbId; children?: ReactNode }) {
  const { socketName, socket } = LIMBS[id]
  return (
    <group name={socketName} position={socket.position} rotation={socket.rotation}>
      {children}
    </group>
  )
}
