// Supabase's built-in Kakao provider appends its default scopes to `scopes`.
// Explicitly set the provider's final `scope` parameter to avoid requesting email.
export function kakaoLoginOptions(redirectTo: string) {
  return {
    provider: 'kakao' as const,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { scope: 'profile_nickname profile_image' },
    },
  };
}
