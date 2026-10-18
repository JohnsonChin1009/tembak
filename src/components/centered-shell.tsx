import { Logo } from "@/components/logo";

/** Single-card layout for small flows: create a workspace, accept an invite. */
export function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Logo className="mb-10 text-lg" />
        {children}
      </div>
    </main>
  );
}
