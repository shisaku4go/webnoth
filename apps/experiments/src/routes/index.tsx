import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@webnoth/ui/components/button';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          webnoth experiments
        </h1>
        <p className="text-muted-foreground">
          Experimental implementations of Wesnoth features on the Web.
        </p>
      </div>
      <div className="flex gap-3">
        <Button>Get Started</Button>
        <Button variant="outline">Learn More</Button>
      </div>
    </div>
  );
}
