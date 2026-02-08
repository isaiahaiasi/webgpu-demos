import type { Component } from "solid-js";
import { LifeRenderer } from "../../scenes/cellular-automata/01_life/LifeRenderer";
import { createSceneWrapper } from "../SceneWrapper/createScene";
import { RenderMediaControls } from "../RenderMediaControls/RenderMediaControls";
import { TapPause } from "../TapPause/TapPause";
import { SceneGui } from "../SceneGui/SceneGui";
import { LifeGui } from "../../scenes/cellular-automata/01_life/LifeGui";
import { DefaultStats } from "../SceneGui/DefaultStats";

const LifeSceneWrapper = createSceneWrapper(async (canvas) => {
  const renderer = new LifeRenderer(canvas, "life");
  await renderer.initialize();
  return renderer;
});

export const LifeScene: Component = () => {
  return (
    <LifeSceneWrapper>
      <RenderMediaControls />
      <TapPause />
      <SceneGui guiClass={LifeGui}>
        <DefaultStats />
      </SceneGui>
    </LifeSceneWrapper>
  );
}
