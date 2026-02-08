import type { Component } from "solid-js";
import { createSceneWrapper } from "../SceneWrapper/createScene";
import { RenderMediaControls } from "../RenderMediaControls/RenderMediaControls";
import { LargerLifeRenderer } from "../../scenes/cellular-automata/02_larger-life/LargerLifeRenderer";
import { TapPause } from "../TapPause/TapPause";
import { SceneGui } from "../SceneGui/SceneGui";
import { LargerLifeGui } from "../../scenes/cellular-automata/02_larger-life/LargerLifeGui";

const LargerLifeWrapper = createSceneWrapper(async (canvas) => {
  const renderer = new LargerLifeRenderer(canvas);
  await renderer.initialize();
  return renderer;
});

export const LargerLifeScene: Component = () => {

  return (
    <LargerLifeWrapper>
      <RenderMediaControls />
      <TapPause />
      <SceneGui guiClass={LargerLifeGui} />
    </LargerLifeWrapper>
  );
}
