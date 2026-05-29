import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@webnoth/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@webnoth/ui/components/card';
import {
  BookOpen,
  Footprints,
  Map as MapIcon,
  Swords,
  Trophy,
} from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto py-6">
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
          Webnoth Experiments
        </h1>
        <p className="text-lg text-muted-foreground">
          Interactive experimental labs and diagnostic dashboards recreating the
          Battle for Wesnoth mechanics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tactical Puzzles Card */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col justify-between">
          <CardHeader className="pb-4">
            <div className="size-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-500 group-hover:scale-110 transition-transform duration-200">
              <Trophy className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              Tactical Puzzles
            </CardTitle>
            <CardDescription className="text-sm mt-1.5 leading-relaxed">
              Solve tactical combat scenarios (Tsume-Shogi style) on miniature
              hex maps with preset squads. Master ZOC and terrain defenses!
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/tactical-puzzle">
              <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold cursor-pointer transition-colors duration-200">
                Play Puzzles
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Battle Simulator Card */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col justify-between">
          <CardHeader className="pb-4">
            <div className="size-12 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4 text-red-500 group-hover:scale-110 transition-transform duration-200">
              <Swords className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              Battle Simulator
            </CardTitle>
            <CardDescription className="text-sm mt-1.5 leading-relaxed">
              Test and analyze 1v1 combat simulations. Configure traits, custom
              HP overrides, status effects (Poison/Slow), terrains, and Time of
              Day phases.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/battle-simulator">
              <Button className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-600 hover:to-amber-500 text-white font-bold cursor-pointer transition-colors duration-200">
                Launch Simulator
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Encyclopedia Card */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col justify-between">
          <CardHeader className="pb-4">
            <div className="size-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-500 group-hover:scale-110 transition-transform duration-200">
              <BookOpen className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              Unit Encyclopedia
            </CardTitle>
            <CardDescription className="text-sm mt-1.5 leading-relaxed">
              Explore the database of Wesnoth units, races, and properties.
              Verify character level advancement paths, costs, and standard
              combat attributes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/encyclopedia">
              <Button
                variant="outline"
                className="w-full cursor-pointer hover:bg-background/80 transition-colors"
              >
                Open Encyclopedia
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Map Encyclopedia Card */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col justify-between">
          <CardHeader className="pb-4">
            <div className="size-12 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-500 group-hover:scale-110 transition-transform duration-200">
              <MapIcon className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              Map Encyclopedia
            </CardTitle>
            <CardDescription className="text-sm mt-1.5 leading-relaxed">
              Browse campaign scenarios and multiplayer maps. View starting
              positions, terrain properties, and map dimensions rendered in
              WebGL.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/encyclopedia/maps">
              <Button
                variant="outline"
                className="w-full cursor-pointer hover:bg-background/80 transition-colors"
              >
                Open Map Encyclopedia
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Unit Movement Simulator Card */}
        <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden hover:shadow-lg transition-all duration-200 group flex flex-col justify-between">
          <CardHeader className="pb-4">
            <div className="size-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-500 group-hover:scale-110 transition-transform duration-200">
              <Footprints className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              Movement Simulator
            </CardTitle>
            <CardDescription className="text-sm mt-1.5 leading-relaxed">
              Simulate multi-player turn-based unit movements. Verify movement
              costs, Zones of Control (ZOC), and test recruitment options on
              real Wesnoth maps.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link to="/unit-movement-simulator">
              <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold cursor-pointer transition-colors duration-200">
                Launch Simulator
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
