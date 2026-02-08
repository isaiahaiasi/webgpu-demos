import type { Component } from "solid-js";
import { createSceneWrapper } from "../SceneWrapper/createScene";
import { RenderMediaControls } from "../RenderMediaControls/RenderMediaControls";
import { SlimeRenderer } from "../../scenes/slime-mold/SlimeRenderer";
import { TapPause } from "../TapPause/TapPause";
import { SceneGui } from "../SceneGui/SceneGui";
import { SlimeGui } from "../../scenes/slime-mold/SlimeGui";
import { DefaultStats } from "../SceneGui/DefaultStats";
import { RenderStats, type StatItem } from "../RenderStats/RenderStats";

const SlimeWrapper = createSceneWrapper(async (canvas) => {
  const renderer = new SlimeRenderer(canvas, "slime");
  await renderer.initialize();
  return renderer;
});

const renderStatItems: StatItem[] = [
  {
    itemName: "fps",
    formatFn: (v) => (1 / v).toFixed(1),
    updateFn: (renderer) => renderer.loop.trueDeltaTime,
  },
  {
    itemName: "js",
    formatFn: (v) => `${v.toFixed(1)}ms`,
    updateFn: (r) => r.loop.jsTime,
  },
  {
    itemName: "agents",
    formatFn: (v) => (v ? `${(v / 1000).toFixed(1)}µs` : "N/A"),
    updateFn: (r) => r.perfTimes.get("agents"),
  },
  {
    itemName: "trails",
    formatFn: (v) => (v ? `${(v / 1000).toFixed(1)}µs` : "N/A"),
    updateFn: (r) => r.perfTimes.get("trails"),
  },
  {
    itemName: "render",
    formatFn: (v) => (v ? `${(v / 1000).toFixed(1)}µs` : "N/A"),
    updateFn: (r) => r.perfTimes.get("render"),
  }
];

export const SlimeScene: Component = () => {
  return (
    <SlimeWrapper>
      <RenderMediaControls />
      <TapPause />
      <SceneGui guiClass={SlimeGui}>
        <DefaultStats />
        <RenderStats items={renderStatItems} />
      </SceneGui>
    </SlimeWrapper>
  );
}
