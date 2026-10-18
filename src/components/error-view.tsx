"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { primaryAction, secondaryAction, StatusPage } from "@/components/status-page";

/** The 500 page, shared by error.tsx and global-error.tsx. */
export function ErrorView({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  return (
    <StatusPage
      variant="misfire"
      code="500 · server error"
      title="Misfire."
      body="Something broke on our side while loading this page. Your messages and apps are safe. Trying again usually fixes it."
      note={<p>That one&apos;s on me, not you. Give it another go, and if it keeps happening, head back home.</p>}
      actions={
        <>
          <button type="button" onClick={() => retry()} className={primaryAction}>
            <RotateCw className="size-4" />
            Try again
          </button>
          <Link href="/" className={secondaryAction}>
            Back to Tembak
          </Link>
        </>
      }
      detail={
        digest && (
          <>
            Error reference <span className="text-muted">{digest}</span>
          </>
        )
      }
    />
  );
}
