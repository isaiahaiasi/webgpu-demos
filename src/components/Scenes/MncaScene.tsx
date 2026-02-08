import type { Component } from "solid-js";
import { createSceneWrapper } from "../SceneWrapper/createScene";
import { RenderMediaControls } from "../RenderMediaControls/RenderMediaControls";
import { MultiLifeRenderer } from "../../scenes/cellular-automata/03_mnca/MultiNeighborRenderer";
import { TapPause } from "../TapPause/TapPause";

const MncaWrapper = createSceneWrapper(async (canvas) => {
  const renderer = new MultiLifeRenderer(canvas);
  await renderer.initialize();
  return renderer;
});

export const MncaScene: Component = () => {
  return (
    <MncaWrapper>
      <RenderMediaControls />
      <TapPause />
    </MncaWrapper>
  );
}
