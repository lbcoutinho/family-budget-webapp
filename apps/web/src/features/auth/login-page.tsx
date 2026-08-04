import { setAccessToken, useLogin } from '@family-budget/api-client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as z from 'zod';

import { AuthCard } from './auth-card';
import { useAuth } from './auth-context';
import { SESSION_QUERY_KEY } from './auth-provider';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type TranslationKey } from '@/i18n';

// The schema is module-level, where `t` does not exist, so its messages are keys and are translated
// where they are rendered. Rebuilding the schema per render just to inject `t` buys nothing.
const loginSchema = z.object({
  email: z.email('auth.invalidEmail' satisfies TranslationKey),
  password: z.string().min(1, 'auth.passwordRequired' satisfies TranslationKey),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * The whole screen has one action. No sign-up, no "forgot my password", no "remember me": the
 * application has a single user created by the seed, and the session restores itself from the
 * refresh cookie.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutate: login, isPending } = useLogin();

  // Separate from the field errors: a rejected credential belongs to the pair, not to either
  // input, and the message must never say which half was wrong.
  const [credentialsRejected, setCredentialsRejected] = useState(false);

  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (user !== null) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = handleSubmit((values) => {
    setCredentialsRejected(false);

    login(
      { data: values },
      {
        onSuccess: (session) => {
          setAccessToken(session.accessToken);
          queryClient.setQueryData(SESSION_QUERY_KEY, session.user);
          void navigate('/', { replace: true });
        },
        onError: (error) => {
          // A 401 here is the credential being rejected, not an expired session: the interceptor
          // exempts `/auth/login` from its refresh-and-replay, so the status arrives untouched.
          if (error.response?.status === 401) {
            setCredentialsRejected(true);
            // Whoever mistyped is going to retype it anyway, and a field still holding the wrong
            // password invites resubmitting the same error.
            resetField('password');
            setFocus('password');

            return;
          }

          toast.error(t('auth.networkError'));
        },
      },
    );
  });

  return (
    <AuthCard>
      {credentialsRejected && (
        <div role="alert" className="mb-3.5 flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/8 p-2.5 text-sm text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <span>{t('auth.invalidCredentials')}</span>
        </div>
      )}

      <form noValidate onSubmit={(event) => void onSubmit(event)} className="grid gap-3.5">
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t('auth.email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder={t('auth.emailPlaceholder')}
            aria-invalid={errors.email !== undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            disabled={isPending}
            {...register('email')}
          />
          {errors.email && (
            <span id="email-error" className="text-xs text-destructive">
              {t(errors.email.message as TranslationKey)}
            </span>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password !== undefined || credentialsRejected}
            aria-describedby={errors.password ? 'password-error' : undefined}
            disabled={isPending}
            {...register('password')}
          />
          {errors.password && (
            <span id="password-error" className="text-xs text-destructive">
              {t(errors.password.message as TranslationKey)}
            </span>
          )}
        </div>

        {/* Full width because it is the only action on the screen, and the busy state lives in the
            button rather than in an overlay — the fields stay readable while it works. */}
        <Button type="submit" className="mt-0.5 w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2Icon className="animate-spin" />
              {t('auth.submitting')}
            </>
          ) : (
            t('auth.submit')
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
