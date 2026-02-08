import { For, onCleanup, onMount, Show, type Component } from "solid-js";
import { useStats } from "../SceneGui/SceneGui";
import type { BaseRenderer } from "../../utils/BaseRenderer";
import { TimingItem } from "./TimingItem";

import "./RenderStats.css";

export interface StatItem {
  itemName: string;
  formatFn: (v: number) => string;
  updateFn: (renderer: BaseRenderer) => number;
}

interface RenderStatsProps {
  items: StatItem[];
  statName?: string;
}

export const RenderStats: Component<RenderStatsProps> = (props) => {
  const { getMode, register, unregister } = useStats();
  let ref: HTMLDivElement | undefined;

  const statName = props.statName ?? "custom";

  onMount(() => register(statName, ref));

  onCleanup(() => { unregister(statName) });

  return (
    <div ref={ref} class={`render-stats-container ${getMode() !== statName ? "hidden" : ""}`}>
      <Show when={getMode() === statName}>
        <pre>
          <For each={props.items}>
            {({ itemName, formatFn, updateFn }) => (
              <TimingItem
                name={itemName}
                formatFn={formatFn}
                updateFn={updateFn}
              />
            )}
          </For>
        </pre>
      </Show>
    </div>
  );
}
