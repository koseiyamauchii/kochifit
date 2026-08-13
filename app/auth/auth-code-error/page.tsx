export default function AuthCodeErrorPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <p className="text-sm text-[var(--muted)]">Work Out</p>
      <h1 className="mt-1 text-2xl font-semibold">ログインに失敗しました</h1>
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
        時間をおいて，もう一度Googleでログインしてください．
      </p>
    </main>
  );
}
