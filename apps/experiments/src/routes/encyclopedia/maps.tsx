import { createFileRoute, Link } from '@tanstack/react-router';
import { Badge } from '@webnoth/ui/components/badge';
import { Card } from '@webnoth/ui/components/card';
import { Input } from '@webnoth/ui/components/input';
import { ScrollArea } from '@webnoth/ui/components/scroll-area';
import { campaigns } from '@webnoth/wesnoth-data/campaigns';
import { multiplayerMaps } from '@webnoth/wesnoth-data/multiplayer';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Map as MapIcon,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MapViewer, parseCell } from '@/components/map-viewer/MapViewer';
import { wesnothAssetUrl } from '@/lib/asset-url';

export interface MapSearch {
  type?: 'campaign' | 'multiplayer';
  campaignId?: string;
  mapId?: string;
}

export const Route = createFileRoute('/encyclopedia/maps')({
  validateSearch: (search: Record<string, unknown>): MapSearch => {
    return {
      type: (search.type as 'campaign' | 'multiplayer') || undefined,
      campaignId: (search.campaignId as string) || undefined,
      mapId: (search.mapId as string) || undefined,
    };
  },
  component: MapEncyclopediaPage,
});

function MapEncyclopediaPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const selectedMap = useMemo(() => {
    if (!search.mapId) return null;
    return {
      type: search.type || 'campaign',
      campaignId: search.campaignId,
      mapId: search.mapId,
    };
  }, [search]);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'multiplayer'>(
    search.type === 'multiplayer' ? 'multiplayer' : 'campaigns',
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Sync tab with selected map type
  useEffect(() => {
    if (selectedMap) {
      setActiveTab(
        selectedMap.type === 'multiplayer' ? 'multiplayer' : 'campaigns',
      );
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

  // Get multiplayer map info (with start counts calculated once)
  const multiplayerMapsWithStarts = useMemo(() => {
    return multiplayerMaps.map((m) => {
      let startsCount = 0;
      for (let r = 0; r < m.grid.length; r++) {
        for (let c = 0; c < m.grid[r].length; c++) {
          const { startPos } = parseCell(m.grid[r][c]);
          if (startPos) startsCount++;
        }
      }
      return {
        ...m,
        startsCount,
      };
    });
  }, []);

  // Filter multiplayer maps
  const filteredMultiplayer = useMemo(() => {
    if (!searchQuery.trim()) return multiplayerMapsWithStarts;
    const q = searchQuery.toLowerCase();
    return multiplayerMapsWithStarts.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q),
    );
  }, [searchQuery, multiplayerMapsWithStarts]);

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

  const selectMap = (
    type: 'campaign' | 'multiplayer',
    campaignId?: string,
    mapId?: string,
  ) => {
    navigate({
      to: '/encyclopedia/maps',
      search: {
        type,
        campaignId,
        mapId,
      },
    });
  };

  const goBack = () => {
    navigate({
      to: '/encyclopedia/maps',
      search: {
        type: undefined,
        campaignId: undefined,
        mapId: undefined,
      },
    });
  };

  if (!selectedMap) {
    return (
      <div className="flex flex-col gap-6 min-h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex flex-col gap-1.5 animate-in fade-in duration-300">
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
            Browse and inspect layouts, starting positions, and terrain details
            from campaigns and multiplayer setups.
          </p>
        </div>

        {/* Tab Selection & Search Box */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-card/45 border border-border/80 backdrop-blur-md rounded-xl p-4 shadow-sm animate-in fade-in duration-300">
          {/* Tabs */}
          <div className="flex bg-muted/40 p-1 rounded-lg border border-border/30 w-full md:w-80">
            <button
              type="button"
              onClick={() => {
                setActiveTab('campaigns');
                setSearchQuery('');
              }}
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
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
              className={`flex-1 text-center py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                activeTab === 'multiplayer'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Multiplayer
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder={`Search ${
                activeTab === 'campaigns'
                  ? 'campaigns/scenarios'
                  : 'multiplayer maps'
              }...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs py-1.5 h-9 bg-background/50"
            />
          </div>
        </div>

        {/* Campaigns Grid */}
        {activeTab === 'campaigns' ? (
          filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-dashed rounded-xl p-12 bg-card/10 animate-in fade-in duration-300">
              <p className="text-sm font-semibold text-muted-foreground">
                No campaigns found
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Try modifying your search term.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              {filteredCampaigns.map((camp) => (
                <Card
                  key={camp.id}
                  className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col h-[320px]"
                >
                  <div className="p-4 border-b border-border/40 flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 truncate">
                      {camp.icon ? (
                        <img
                          src={wesnothAssetUrl(camp.icon.split('~')[0])}
                          alt=""
                          className="size-7 object-contain group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <BookOpen className="size-6 text-amber-500 shrink-0" />
                      )}
                      <h3 className="font-bold text-sm text-foreground truncate">
                        {camp.name}
                      </h3>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium py-0.5 px-2 bg-background/50 border-border/60 shrink-0"
                    >
                      {camp.scenarios.length} Scenarios
                    </Badge>
                  </div>

                  <ScrollArea className="flex-1 p-3">
                    <div className="flex flex-col gap-1.5">
                      {camp.scenarios.map((scen) => (
                        <button
                          key={scen.id}
                          type="button"
                          onClick={() =>
                            selectMap('campaign', camp.id, scen.id)
                          }
                          className="w-full text-left px-3 py-2 text-xs rounded-md bg-muted/20 hover:bg-amber-500/10 hover:text-amber-500 border border-border/20 hover:border-amber-500/30 transition-all truncate font-medium cursor-pointer"
                        >
                          {scen.name}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              ))}
            </div>
          )
        ) : /* Multiplayer Maps Grid */
        filteredMultiplayer.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed rounded-xl p-12 bg-card/10 animate-in fade-in duration-300">
            <p className="text-sm font-semibold text-muted-foreground">
              No multiplayer maps found
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Try modifying your search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {filteredMultiplayer.map((m) => (
              <Card
                key={m.id}
                className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col justify-between p-4 cursor-pointer hover:border-amber-500/30"
                onClick={() => selectMap('multiplayer', undefined, m.id)}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                      <MapIcon className="size-4.5" />
                    </div>
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {m.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium py-0.5 px-2 bg-background/50 border-border/60"
                    >
                      Size: {m.width} × {m.height}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] font-medium py-0.5 px-2 bg-background/50 border-border/60"
                    >
                      {m.startsCount} Players
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-amber-500 font-semibold group-hover:text-amber-400 transition-colors">
                  <span>View Map Layout</span>
                  <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-6rem)]">
      {/* Header breadcrumb & info */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1 animate-in fade-in duration-300">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="size-3" />
            Back to Map Selection
          </button>
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

      {currentMap ? (
        <MapViewer
          grid={currentMap.grid}
          items={currentMap.items}
          labels={currentMap.labels}
          name={currentMap.name}
          campaignName={currentCampaignName}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center border border-dashed rounded-xl p-8 bg-card/20 animate-in fade-in duration-300">
          <div className="text-center space-y-2">
            <MapIcon className="size-12 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-muted-foreground">
              No map found
            </p>
            <p className="text-xs text-muted-foreground/60">
              The selected map does not exist. Please go back to the selection
              screen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
