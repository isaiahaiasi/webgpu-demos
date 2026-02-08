import { createEffect, onCleanup, type Component } from "solid-js";
import { useCanvas, useRenderer } from "../SceneWrapper/createScene";


export const TapPause: Component = () => {
  const getRenderer = useRenderer();
  const getCanvas = useCanvas();

  const handlePlayPause = () => {
    const renderer = getRenderer();
    if (!renderer) return;
    
    if (renderer.loop.paused) {
      renderer.loop.start();
    } else {
      renderer.loop.stop();
    }
  };

  createEffect(() => {
    const canvas = getCanvas();

    canvas.addEventListener('click', handlePlayPause);

    onCleanup(() => {
      canvas.removeEventListener('click', handlePlayPause);
    });
  });

  return (
    <></>
  );
};
