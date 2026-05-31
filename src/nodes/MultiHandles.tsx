import { Handle, Position } from '@xyflow/react'
import { handleDot } from './multiHandleStyles'

/** Call Stack: entradas izq. (macro/micro), salida .then(), Web APIs y consola. */
export function CallStackHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} id="la" title="Macrotarea entra" style={handleDot('18%', 'left')} />
      <Handle type="source" position={Position.Left} id="ls" title="Encolar microtarea (.then)" style={handleDot('42%', 'left')} />
      <Handle type="target" position={Position.Left} id="lc" title="Microtarea entra" style={handleDot('76%', 'left')} />
      <Handle type="source" position={Position.Right} id="ra" title="setTimeout → Web APIs" style={handleDot('40%', 'right')} />
      <Handle type="source" position={Position.Bottom} id="ba" title="console.log → consola" style={handleDot('50%', 'bottom')} />
    </>
  )
}

/** Web APIs: entrada desde stack, salida hacia cola macro. */
export function WebApisHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} id="lc" title="Desde Call Stack" style={handleDot('50%', 'left')} />
      <Handle type="source" position={Position.Right} id="r1" title="Timer → macrotareas" style={handleDot('50%', 'right')} />
    </>
  )
}

/** Cola de microtareas: recibe .then(), devuelve al stack. */
export function MicrotaskQueueHandles() {
  return (
    <>
      <Handle type="target" position={Position.Right} id="ri" title="Desde Call Stack (.then)" style={handleDot('32%', 'right')} />
      <Handle type="source" position={Position.Right} id="rc" title="Ejecutar micro → stack" style={handleDot('68%', 'right')} />
    </>
  )
}

/** Cola de macrotareas: recibe timers, devuelve al stack. */
export function MacrotaskQueueHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="t3" title="Timer listo" style={handleDot('50%', 'top')} />
      <Handle type="source" position={Position.Right} id="rc" title="Ejecutar macro → stack" style={handleDot('50%', 'right')} />
    </>
  )
}

/** Consola: recibe console.log del stack. */
export function ConsoleHandles() {
  return (
    <>
      <Handle type="target" position={Position.Top} id="ta" title="Desde Call Stack" style={handleDot('50%', 'top')} />
    </>
  )
}
