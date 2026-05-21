import { createFileRoute, Link } from '@tanstack/react-router';
import { Badge } from '@webnoth/ui/components/badge';
import { Card, CardContent } from '@webnoth/ui/components/card';
import { Input } from '@webnoth/ui/components/input';
import { ScrollArea } from '@webnoth/ui/components/scroll-area';
import { Separator } from '@webnoth/ui/components/separator';
import { campaigns } from '@webnoth/wesnoth-data/campaigns';
import { multiplayerMaps } from '@webnoth/wesnoth-data/multiplayer';
import { terrains } from '@webnoth/wesnoth-data/terrains';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Flag,
  Info,
  Map as MapIcon,
  Maximize2,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MapViewer, parseCell } from '@/components/map-viewer/MapViewer';
import { wesnothAssetUrl } from '@/lib/asset-url';

export const Route = createFileRoute('/encyclopedia/maps')({
  component: MapEncyclopediaPage,
});

interface SelectedMapState {
  type: 'campaign' | 'multiplayer';
  campaignId?: string;
  mapId: string;
}

function MapEncyclopediaPage() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'multiplayer'>(
    'campaigns',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCampaigns, setExpandedCampaigns] = useState<
    Record<string, boolean>
  >({});
  const [selectedMap, setSelectedMap] = useState<SelectedMapState | null>(null);
  const [hoveredHex, setHoveredHex] = useState<{
    x: number;
    y: number;
    code: string;
    terrainName: string;
  } | null>(null);

  // Set default selection
  useEffect(() => {
    if (!selectedMap) {
      if (campaigns.length > 0 && campaigns[0].scenarios.length > 0) {
        setSelectedMap({
          type: 'campaign',
          campaignId: campaigns[0].id,
          mapId: campaigns[0].scenarios[0].id,
        });
        setExpandedCampaigns({ [campaigns[0].id]: true });
      }
    }
  }, [selectedMap]);

  // Filter campaigns & their scenarios
  const filteredCampaigns = useMemo(() => {
    if (!searchQuery.trim()) return campaigns;
    const q = searchQuery.toLowerCase();
    return campaigns
      .map((c) => ({
        ...c,
        scenarios: c.scenarios.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.id.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.scenarios.length > 0);
  }, [searchQuery]);

  // Filter multiplayer maps
  const filteredMultiplayer = useMemo(() => {
    if (!searchQuery.trim()) return multiplayerMaps;
    const q = searchQuery.toLowerCase();
    return multiplayerMaps.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  // Auto-expand campaigns when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const nextExpanded: Record<string, boolean> = {};
      for (const c of filteredCampaigns) {
        nextExpanded[c.id] = true;
      }
      setExpandedCampaigns(nextExpanded);
    }
  }, [searchQuery, filteredCampaigns]);

  // Get active map object
  const currentMap = useMemo(() => {
    if (!selectedMap) return null;
    if (selectedMap.type === 'campaign') {
      const campaign = campaigns.find((c) => c.id === selectedMap.campaignId);
      return (
        campaign?.scenarios.find((s) => s.id === selectedMap.mapId) || null
      );
    } else {
      return multiplayerMaps.find((m) => m.id === selectedMap.mapId) || null;
    }
  }, [selectedMap]);

  // Get active campaign name
  const currentCampaignName = useMemo(() => {
    if (!selectedMap || selectedMap.type !== 'campaign')
      return 'Multiplayer Maps';
    return (
      campaigns.find((c) => c.id === selectedMap.campaignId)?.name ?? 'Campaign'
    );
  }, [selectedMap]);

  // Calculate starting positions from grid
  const startingPositions = useMemo(() => {
    if (!currentMap) return [];
    const list: { id: string; x: number; y: number }[] = [];
    for (let r = 0; r < currentMap.grid.length; r++) {
      for (let c = 0; c < currentMap.grid[r].length; c++) {
        const { startPos } = parseCell(currentMap.grid[r][c]);
        if (startPos) {
          list.push({ id: startPos, x: c + 1, y: r + 1 });
        }
      }
    }
    return list.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  }, [currentMap]);

  // Extract unique terrains used in the map
  const usedTerrains = useMemo(() => {
    if (!currentMap) return [];
    const codes = new Set<string>();
    for (const row of currentMap.grid) {
      for (const cell of row) {
        const { baseCode, overlayCode } = parseCell(cell);
        codes.add(baseCode);
        if (overlayCode) {
          codes.add(`^${overlayCode}`);
        }
      }
    }
    const list = terrains.filter((t) => codes.has(t.code));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [currentMap]);

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-6rem)]">
      {/* Header breadcrumb & info */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            to="/encyclopedia"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="size-3" />
            Back to Encyclopedia
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent flex items-center gap-2.5">
            <MapIcon className="size-8 text-amber-500" />
            Map Encyclopedia
          </h1>
          <p className="text-sm text-muted-foreground">
            Explore and inspect layouts, player starts, and terrain details from
            campaigns and multiplayer setups.
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch flex-1">
        {/* Left Navigation Sidebar */}
        <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4 border border-border/80 bg-card/45 backdrop-blur-md rounded-xl p-4 shadow-sm">
          {/* Tabs */}
          <div className="flex bg-muted/40 p-1 rounded-lg border border-border/30">
            <button
              type="button"
              onClick={() => {
                setActiveTab('campaigns');
                setSearchQuery('');
              }}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'campaigns'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Campaigns
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('multiplayer');
                setSearchQuery('');
              }}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'multiplayer'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Multiplayer
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={`Search ${activeTab === 'campaigns' ? 'campaigns/scenarios' : 'multiplayer maps'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs py-1.5 h-9"
            />
          </div>

          <Separator className="bg-border/60" />

          {/* Scrollable list */}
          <ScrollArea className="flex-1 h-[450px] lg:h-[calc(100vh-22rem)] pr-2">
            <div className="space-y-1.5">
              {activeTab === 'campaigns' ? (
                filteredCampaigns.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No campaigns found
                  </p>
                ) : (
                  filteredCampaigns.map((camp) => {
                    const isExpanded = expandedCampaigns[camp.id];
                    return (
                      <div key={camp.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleCampaign(camp.id)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-bold rounded-lg hover:bg-muted/50 transition-colors text-left text-foreground cursor-pointer"
                        >
                          <div className="flex items-center gap-2 truncate">
                            {camp.icon ? (
                              <img
                                src={wesnothAssetUrl(camp.icon.split('~')[0])}
                                alt=""
                                className="size-4 shrink-0 object-contain"
                                onError={(e) => {
                                  // Fallback if image fails to load
                                  (e.target as HTMLElement).style.display =
                                    'none';
                                }}
                              />
                            ) : (
                              <BookOpen className="size-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="truncate">{camp.name}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="pl-6 space-y-0.5 border-l border-border/50 ml-4 animate-in fade-in slide-in-from-left-1 duration-150">
                            {camp.scenarios.map((scen) => {
                              const isSelected =
                                selectedMap?.type === 'campaign' &&
                                selectedMap.mapId === scen.id;
                              return (
                                <button
                                  key={scen.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedMap({
                                      type: 'campaign',
                                      campaignId: camp.id,
                                      mapId: scen.id,
                                    })
                                  }
                                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors truncate cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500/10 text-amber-500 font-semibold border-l-2 border-amber-500 pl-2 rounded-l-none'
                                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                                  }`}
                                >
                                  {scen.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              ) : filteredMultiplayer.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No maps found
                </p>
              ) : (
                filteredMultiplayer.map((m) => {
                  const isSelected =
                    selectedMap?.type === 'multiplayer' &&
                    selectedMap.mapId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setSelectedMap({
                          type: 'multiplayer',
                          mapId: m.id,
                        })
                      }
                      className={`w-full text-left px-2.5 py-2 text-xs rounded-lg transition-colors truncate cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/10 text-amber-500 font-semibold border-l-2 border-amber-500 pl-2 rounded-l-none'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* Center Canvas Area & Detail Panel */}
        <div className="flex-1 flex flex-col gap-4">
          {currentMap ? (
            <>
              {/* Map Info Card */}
              <Card className="border-border/80 bg-card/45 backdrop-blur-md shadow-sm">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500">
                      {currentCampaignName}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      {currentMap.name}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge
                      variant="outline"
                      className="text-xs font-medium tabular-nums py-0.5 px-2 bg-background/50 border-border/60"
                    >
                      Dimensions: {currentMap.width} × {currentMap.height}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs font-medium py-0.5 px-2 bg-background/50 border-border/60"
                    >
                      Starts: {startingPositions.length}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Map Renderer Canvas */}
              <div className="flex-1 min-h-[500px] h-[550px] lg:h-[calc(100vh-18rem)] relative rounded-xl border border-border/80 shadow-md overflow-hidden bg-zinc-950 flex flex-col">
                <MapViewer
                  grid={currentMap.grid}
                  items={currentMap.items}
                  labels={currentMap.labels}
                  onHoverHex={setHoveredHex}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed rounded-xl p-8 bg-card/20">
              <div className="text-center space-y-2">
                <MapIcon className="size-12 text-muted-foreground/40 mx-auto" />
                <p className="text-sm font-semibold text-muted-foreground">
                  No map selected
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Please choose a campaign scenario or multiplayer map from the
                  sidebar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Info & Legend Sidebar */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 border border-border/80 bg-card/45 backdrop-blur-md rounded-xl p-4 shadow-sm">
          {/* 1. Hex Inspector Panel */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Maximize2 className="size-3.5 text-amber-500" />
              Tile Inspector
            </h3>
            <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 min-h-[5.5rem] flex flex-col justify-center">
              {hoveredHex ? (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                    <span>Coordinates (WML)</span>
                    <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono tabular-nums">
                      x={hoveredHex.x + 1}, y={hoveredHex.y + 1}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-foreground">
                    {hoveredHex.terrainName}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Raw Code</span>
                    <span className="font-mono bg-muted/30 px-1 py-0.2 rounded text-muted-foreground select-all">
                      {hoveredHex.code}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-muted-foreground/80 italic flex items-center justify-center gap-1.5">
                  <Info className="size-3.5" />
                  Hover map tiles to inspect
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-border/60" />

          {/* 2. Starting Positions Panel */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flag className="size-3.5 text-amber-500" />
              Starting Positions
            </h3>
            <ScrollArea className="max-h-36 pr-1">
              {startingPositions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No starting positions defined on this map.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {startingPositions.map((pos) => (
                    <div
                      key={`start-${pos.id}`}
                      className="flex items-center justify-between gap-1.5 bg-muted/30 border border-border/30 rounded px-2 py-1 text-[11px] font-medium"
                    >
                      <span className="text-amber-500 font-bold shrink-0">
                        Player {pos.id}
                      </span>
                      <span className="text-muted-foreground font-mono tabular-nums text-[10px]">
                        ({pos.x}, {pos.y})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <Separator className="bg-border/60" />

          {/* 3. Terrain Legend Panel */}
          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shrink-0">
              <BookOpen className="size-3.5 text-amber-500" />
              Terrain Legend ({usedTerrains.length})
            </h3>
            <ScrollArea className="flex-1 pr-1 max-h-[300px] lg:max-h-[calc(100vh-28rem)]">
              {usedTerrains.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No terrains found.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {usedTerrains.map((terrain) => (
                    <div
                      key={`legend-${terrain.code}`}
                      className="flex items-center gap-2 bg-muted/20 hover:bg-muted/40 border border-border/20 rounded-md p-1.5 transition-colors"
                    >
                      <div className="size-8 rounded bg-zinc-900 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden relative">
                        {terrain.symbolImage ? (
                          <img
                            src={wesnothAssetUrl(
                              `terrain/${terrain.symbolImage}.png`,
                            )}
                            alt=""
                            className="size-7 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="size-full bg-muted/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-foreground truncate leading-tight">
                          {terrain.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 rounded">
                            {terrain.code}
                          </span>
                          {terrain.editorGroup &&
                            terrain.editorGroup.length > 0 && (
                              <span className="text-[8px] text-amber-500 font-semibold uppercase tracking-wider">
                                {terrain.editorGroup[0]}
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </aside>
      </div>
    </div>
  );
}
