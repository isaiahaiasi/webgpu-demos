import type { Component } from "solid-js";
import { createSceneWrapper } from "../SceneWrapper/createScene";
import { RenderMediaControls } from "../RenderMediaControls/RenderMediaControls";
import { SlimeRenderer } from "../../scenes/slime-mold/SlimeRenderer";

const SlimeWrapper = createSceneWrapper(async (canvas) => {
  const renderer = new SlimeRenderer(canvas, "slime");
  await renderer.initialize();
  return renderer;
});

export const SlimeScene: Component = () => {
  return (
    <SlimeWrapper>
      <RenderMediaControls />
    </SlimeWrapper>
  );
}
