import { createEffect, onCleanup, onMount, type Component } from "solid-js";
import type { BaseGui } from "../../utils/BaseGui";
import type { BaseRenderer } from "../../utils/BaseRenderer";
import { useRenderer } from "../SceneWrapper/createScene";

import "./SceneGui.css";


type SceneGuiProps = {
  guiClass: new (renderer: BaseRenderer, container: HTMLElement) => BaseGui;
}

export const SceneGui: Component<SceneGuiProps> = ({ guiClass }: SceneGuiProps ) => {

  let containerRef: HTMLDivElement | undefined;
  const getRenderer = useRenderer();

  createEffect(() => {
    const renderer = getRenderer();

    if (!renderer) return;

    const gui = new guiClass(renderer, containerRef);
    gui.init();

    onCleanup(() => {
      gui.destroy();
    });
  });

  return <div class="gui-container" ref={containerRef} />
}