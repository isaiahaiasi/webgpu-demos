import { createEffect, createSignal, type Component } from "solid-js";
import "./RenderMediaControls.css";
import { useRenderer } from "../SceneWrapper/createScene";


export const RenderMediaControls: Component = () => {
  const getRenderer = useRenderer();

  const [frameCount, setFrameCount] = createSignal(0);
  const [time, setTime] = createSignal("0.000");
  const [playPauseText, setPlayPauseText] = createSignal("Stop");

  // Set up callbacks when renderer becomes available
  createEffect(() => {
    const renderer = getRenderer();
    if (!renderer) return;

    renderer.onRender(() => {
      setFrameCount(renderer.loop.frameCount);
      setTime(renderer.loop.timeSinceFirstRender.toFixed(3));
    });
    
    renderer.onStart(() => {
      setPlayPauseText("Stop");
    });
    
    renderer.onStop(() => {
      setPlayPauseText("Play");
    });
  });

  const handlePlayPause = () => {
    const renderer = getRenderer();
    if (!renderer) return;
    
    if (renderer.loop.paused) {
      renderer.loop.start();
    } else {
      renderer.loop.stop();
    }
  };

  const handleReset = () => {
    getRenderer()?.restart();
  };

  const handleStep = () => {
    const renderer = getRenderer();
    if (!renderer) return;
    
    if (!renderer.loop.paused) {
      renderer.loop.stop();
    }
    renderer.loop.step();
  };

  return (
    <div class="render-controls">
      <div class="controls-buttons">
        <button onClick={handlePlayPause} disabled={!getRenderer()}>
          {playPauseText()}
        </button>
        <button onClick={handleStep} disabled={!getRenderer()}>
          Step
        </button>
        <button onClick={handleReset} disabled={!getRenderer()}>
          Reset
        </button>
      </div>
      <div class="controls-info">
        <div class="info-item frame-info">
          F:<span>{frameCount()}</span>
        </div>
        <div class="info-item time-info">
          T:<span>{time()}</span>
        </div>
      </div>
    </div>
  );
};
