import "./RegionMap.css";
import regionMapArt from "./region-map.png";

// Adapted from a supplied pixel-art map package (region-map.png + a reference React
// component) - see docs/ARCHITECTURE.md "Regions & shared liberation". The original
// component took its own xp/liberationByRegion/deployedRegionId props; this version takes
// the same `World[]` shape WorldMap.tsx already fetches from `GET /api/worlds` instead, so
// there's one source of truth for unlock/liberation state (the server), not two.
//
// Marker coordinates are percentages relative to the image (1570x1002 source), keyed by
// the same region `key` values already used throughout the backend (World.key in
// schema.prisma / seed.ts) - no ID translation needed, they matched exactly.
const REGION_COORDS: Record<string, { x: number; y: number }> = {
  "forgotten-village": { x: 14, y: 67 },
  "cursed-forest": { x: 26, y: 34 },
  "abandoned-mine": { x: 47, y: 19 },
  wasteland: { x: 61, y: 62 },
  "dark-fortress": { x: 76, y: 39 },
  "dragons-realm": { x: 90, y: 12 },
};

const THEME_ICON: Record<string, string> = {
  meadow: "🏘️",
  forest: "🌲",
  cave: "⛏️",
  wasteland: "🏜️",
  fortress: "🏰",
  volcano: "🌋",
};

export interface RegionMapWorld {
  id: string;
  key: string;
  name: string;
  theme: string | null;
  xpRequirement: number;
  unlocked: boolean;
  isCurrent: boolean;
  liberationPct: number;
}

interface RegionMapProps {
  regions: RegionMapWorld[];
  onDeploy: (regionId: string) => void;
  deploying?: string | null;
}

export function RegionMap({ regions, onDeploy, deploying }: RegionMapProps) {
  return (
    <section className="region-map panel" aria-label="RPG region map">
      <div className="region-map__canvas">
        <img
          className="region-map__art"
          src={regionMapArt}
          alt="Pixel art world map with a village, cursed forest, mine, wasteland, fortress, and dragon volcano"
          draggable="false"
        />
        {regions.map((region, index) => {
          const coords = REGION_COORDS[region.key] ?? { x: 10 + index * 15, y: 90 };
          const locked = !region.unlocked;
          const icon = locked ? "🔒" : region.isCurrent ? "⚔" : (region.theme && THEME_ICON[region.theme]) || String(index + 1);
          const liberation = Math.max(0, Math.min(100, Math.round(region.liberationPct)));
          const status = locked
            ? `requires ${region.xpRequirement.toLocaleString()} XP`
            : `${liberation}% liberated`;

          return (
            <button
              key={region.id}
              type="button"
              className={`region-map__marker${region.isCurrent ? " is-active" : ""}${locked ? " is-locked" : ""}`}
              style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
              disabled={locked || region.isCurrent || deploying === region.id}
              onClick={() => onDeploy(region.id)}
              aria-label={`${region.name}: ${status}${region.isCurrent ? ", currently deployed" : ""}`}
              title={`${region.name} — ${status}`}
            >
              <span className="region-map__marker-icon" aria-hidden="true">
                {icon}
              </span>
              <span className="region-map__marker-name">{region.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
