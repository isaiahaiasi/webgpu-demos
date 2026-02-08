import { createEffect, onCleanup } from "solid-js";
import { useRenderer } from "../SceneWrapper/createScene";
import { useStats } from "./SceneGui";
import type { BaseRenderer } from "../../utils/BaseRenderer";

type InitFn = (renderer: BaseRenderer, container: HTMLElement) => void | (() => void);


/**
 * Hook for managing a statistics panel that initializes when conditions are met.
 * 
 * Creates a ref callback for attaching to a stats container element. The provided
 * initialization function is called when the renderer becomes available and the
 * current stats mode matches the specified name. The init function may optionally
 * return a cleanup function that will be executed when the effect is cleaned up.
 * 
 * @param name - The identifier for this stats panel, used to match against the current stats mode
 * @param init - Initialization function called with the renderer and container element.
 *               May return an optional cleanup function to be called on effect cleanup.
 * @returns A ref setter function to attach to the stats container HTMLDivElement.
 *          Automatically registers/unregisters the panel with the stats context.
 * 
 * @example
 * ```typescript
 * const panelRef = useStatsPanel("fps", (renderer, container) => {
 *   const canvas = document.createElement("canvas");
 *   container.appendChild(canvas);
 *   
 *   return () => {
 *     container.removeChild(canvas);
 *   };
 * });
 * 
 * <div ref={panelRef} />
 * ```
 */
export function useImperativeStatsPanel(name: string, init: InitFn) {
  const getRenderer = useRenderer();
  const { getMode, register, unregister } = useStats();
  let container: HTMLDivElement | undefined;

  createEffect(() => {
    const renderer = getRenderer();
    const doRender = getMode() === name;
    if (!doRender || !renderer || !container) return;

    const cleanup = init(renderer as BaseRenderer, container);

    onCleanup(() => {
      if (typeof cleanup === "function") cleanup();
    });
  });

  onCleanup(() => {
    unregister(name);
  });

  return (el?: HTMLDivElement) => {
    // ref setter: register immediately when element is attached
    container = el;
    if (el) register(name, el);
    else unregister(name);
  };
}
