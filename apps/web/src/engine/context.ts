import { createContext, useContext, type RefObject } from 'react';
import type { VehicleRegistry } from './registry';
import type { Pose } from './timeline';

export interface EngineContextValue {
  registry: VehicleRegistry;
  /** The current (damped) pose — written by VehicleController, read by camera and model. */
  pose: RefObject<Pose>;
}
export const EngineContext = createContext<EngineContextValue | null>(null);
export function useEngineContext() {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('Vehicle engine components must be rendered inside <VehicleScene>');
  return ctx;
}
