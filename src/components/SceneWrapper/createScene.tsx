import { createSignal, createContext, useContext, onMount, type Component, type JSX } from "solid-js";
import type { BaseRenderer } from "../../utils/BaseRenderer";


interface RendererContextValue {
  renderer: () => BaseRenderer | null;
  canvas: () => HTMLCanvasElement | null;
  error: () => string | null;
}


const RendererContext = createContext<RendererContextValue>();


export function useRenderer() {
  const ctx = useContext(RendererContext);
  if (!ctx) throw new Error("useRenderer must be used within createScene");
  return ctx.renderer;
}

export function useCanvas() {
  const ctx = useContext(RendererContext);
  if (!ctx) throw new Error("useCanvas must be used within createScene");
  return ctx.canvas;
}

/**
 * Helper to create a scene component with a specific renderer.
 * Use this in each scene file to avoid boilerplate.
 * 
 * Example:
 * export const SlimeScene = createScene(
 *   async (canvas) => {
 *     const r = new SlimeRenderer(canvas, 'slime');
 *     await r.initialize();
 *     return r;
 *   }
 * );
 */
export function createSceneWrapper(
  createRenderer: (canvas: HTMLCanvasElement) => Promise<BaseRenderer>,
  canvasId = 'scene-canvas'
): Component<{ children?: JSX.Element }> {
  return (props) => {
    const [renderer, setRenderer] = createSignal<BaseRenderer | null>(null);
    const [error, setError] = createSignal<string | null>(null);

    let canvasRef: HTMLCanvasElement | undefined;

    onMount(async () => {
      if (!canvasRef) return;

      try {
        const r = await createRenderer(canvasRef);
        setRenderer(r);

        r.onStart(() => { canvasRef.classList.remove("paused") });
        r.onStop(() => { canvasRef.classList.add("paused") });

      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        console.error("Failed to create renderer:", err);
      }
    });

    const contextValue: RendererContextValue = {
      renderer,
      error,
      canvas: () => canvasRef,
    };

    return (
      <RendererContext.Provider value={contextValue}>
        <div class="canvas-container">
          {error() && <div class="error-message">{error()}</div>}
          <canvas ref={canvasRef} id={canvasId} />
          {props.children}
        </div>
      </RendererContext.Provider>
    );
  };
}
