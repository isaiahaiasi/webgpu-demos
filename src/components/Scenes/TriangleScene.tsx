import type { Component } from "solid-js";
import { createSceneWrapper } from "../SceneWrapper/createScene";
import { RenderMediaControls } from "../RenderMediaControls/RenderMediaControls";
import { TriangleRenderer } from "../../scenes/triangle/TriangleRenderer";
import { TapPause } from "../TapPause/TapPause";


const TriangleWrapper = createSceneWrapper(async (canvas) => {
  const renderer = new TriangleRenderer(canvas, "tri");
  await renderer.initialize();
  return renderer;
});

export const TriangleScene: Component = () => {
  return (
    <TriangleWrapper>
      <RenderMediaControls />
      <TapPause />
    </TriangleWrapper>
  );
}
