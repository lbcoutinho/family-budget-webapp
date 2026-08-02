import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/features/auth/auth-context';

// Placeholder home screen, still. It now sits behind `ProtectedRoute`, so it is also the proof
// that a session exists — and the only place to end one until the real shell arrives (M5).
export function LandingPage() {
  const { user, logout } = useAuth();

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Family Budget</CardTitle>
          <CardDescription>Olá, {user?.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void logout()}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
