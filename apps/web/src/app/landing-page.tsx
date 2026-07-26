import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder landing page. Exists to prove the stack renders end to end: a styled shadcn Card and
// Button, Tailwind theme tokens applied, and the Sonner toaster wired through the providers.
export function LandingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Family Budget</CardTitle>
          <CardDescription>Frontend foundation is up and running.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => toast.success('It works!')}>Say hello</Button>
        </CardContent>
      </Card>
    </main>
  );
}
