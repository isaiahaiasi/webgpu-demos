import type { Component } from "solid-js";
import Stats from "stats.js";
import { useImperativeStatsPanel } from "./useImperativeStatsPanel";

interface DefaultStatsProps {
  statName?: string;
}

export const DefaultStats: Component<DefaultStatsProps> = (props) => {
  const ref = useImperativeStatsPanel(
    props.statName ?? "default",
    (renderer, container) => {
      const stats = new Stats();
      stats.showPanel(0);
      stats.dom.style.position = 'absolute';

      const listenerId = renderer.onRender(() => { stats.update(); });

      container.appendChild(stats.dom);

      return () => {
        stats.dom.remove();
        renderer.loop.pubsub.remove("render", listenerId);
      };
    }
  );

  return <div ref={ref} class="stats-container" />;
}
