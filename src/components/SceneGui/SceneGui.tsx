import { createEffect, createSignal, createContext, onCleanup, type Component, type JSX, useContext } from "solid-js";
import type { BaseGui } from "../../utils/BaseGui";
import type { BaseRenderer } from "../../utils/BaseRenderer";
import { useRenderer } from "../SceneWrapper/createScene";

import "./SceneGui.css";


type StatsOptions = "default" | "custom" | "none";

interface StatsContextValue {
  getMode: () => StatsOptions;
  register: (name: string, el: HTMLElement) => void;
  unregister: (name: string) => void;
}

const StatsContext = createContext<StatsContextValue>();

export function useStats() {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error("useStatsMode must be used within StatsContext");
  return ctx;
}


interface SceneGuiProps {
  guiClass: new (renderer: BaseRenderer, container: HTMLElement) => BaseGui;
  children?: JSX.Element;
}

export const SceneGui: Component<SceneGuiProps> = (props) => {

  const [activeStatsName, setActiveStatsName] = createSignal<StatsOptions>("default");
  const [statsMap, setStatsMap] = createSignal<Record<string, HTMLElement>>({});

  const register = (name: string, el: HTMLElement) => {
    setStatsMap(prev => prev[name] === el ? prev : { ...prev, [name]: el });
  };

  const unregister = (name: string) => {
    setStatsMap(prev => {
      if (!(name in prev))
        return prev;

      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  const contextValue: StatsContextValue = {
    getMode: activeStatsName,
    register,
    unregister,
  };

  const getRenderer = useRenderer();
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    const renderer = getRenderer();

    if (!renderer) return;

    const gui = new props.guiClass(renderer, containerRef);
    gui.init();

    const options = ["none", ...Object.keys(statsMap())];
    const boundOptionsObject = { stats: activeStatsName() };

    if (options.length > 1) {
      gui.options.add(boundOptionsObject, "stats", options)
        .onChange((v: StatsOptions) => setActiveStatsName(v));
    }

    onCleanup(() => {
      gui.destroy();
    });
  });

  return (
    <StatsContext.Provider value={contextValue}>
      <div class="gui-container" ref={containerRef}>
        {props.children}
      </div>
    </StatsContext.Provider>
  );
}
