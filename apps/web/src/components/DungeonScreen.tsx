import type { ReactNode } from "react";
import "./DungeonScreen.css";

// First-person "viewport into the dungeon" - the atmospheric scene art for a region, framed
// like a classic first-person dungeon crawler (Dungeon Master/Eye of the Beholder-style):
// a bordered window onto the scene, an optional sprite standing in it (the monster you're
// facing), and an information bar bolted on underneath (portrait/stats/readouts), instead
// of a plain text block. Backgrounds are looked up by region *theme*, not id, since both
// WorldMap.tsx (World.theme) and Dashboard.tsx (CharacterSummary.world.theme) already have
// that field on hand without an extra fetch.
const REGION_BACKGROUND: Record<string, string> = {
  meadow: "/regions/forgotten-village.webp",
  forest: "/regions/cursed-forest.webp",
  cave: "/regions/abandoned-mine.webp",
  wasteland: "/regions/wasteland.webp",
  fortress: "/regions/dark-fortress.webp",
  volcano: "/regions/dragons-realm.webp",
};

interface DungeonScreenProps {
  theme: string | null;
  label?: string;
  /** Rendered inside the viewport, over the background art (e.g. the monster sprite). */
  overlay?: ReactNode;
  /** Rendered as the HUD strip bolted under the viewport (stat readouts). */
  children?: ReactNode;
}

export function DungeonScreen({ theme, label, overlay, children }: DungeonScreenProps) {
  const bg = theme ? REGION_BACKGROUND[theme] : undefined;

  return (
    <div className="dungeon-screen panel">
      <div className="dungeon-screen__viewport">
        {bg && <img src={bg} alt="" className="dungeon-screen__bg" draggable="false" />}
        <div className="dungeon-screen__vignette" />
        {overlay}
        {label && <div className="dungeon-screen__label">{label}</div>}
      </div>
      {children && <div className="dungeon-screen__hud">{children}</div>}
    </div>
  );
}

export function DungeonHudCell({ label, value, grow }: { label: string; value: ReactNode; grow?: boolean }) {
  return (
    <div className={`dungeon-hud-cell${grow ? " dungeon-hud-cell--grow" : ""}`}>
      <span className="dungeon-hud-cell__label">{label}</span>
      <span className="dungeon-hud-cell__value">{value}</span>
    </div>
  );
}
