import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RequestedPath } from "@/components/requested-path";
import { primaryAction, StatusPage } from "@/components/status-page";

export const metadata: Metadata = {
  title: "Not found · Tembak",
};

export default function NotFound() {
  return (
    <StatusPage
      variant="miss"
      code="404 · not found"
      title="Missed the target."
      body="There's nothing at this address. The page may have moved, the app may have been unpublished, or the link was mistyped."
      note={
        <p>
          I looked for <RequestedPath /> and came up empty. If someone shared this link in a channel, ask them for
          the latest one.
        </p>
      }
      actions={
        <Link href="/" className={primaryAction}>
          <ArrowLeft className="size-4" />
          Back to Tembak
        </Link>
      }
    />
  );
}
