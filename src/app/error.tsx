"use client";

import { ErrorView } from "@/components/error-view";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <>
      <title>Something went wrong · Tembak</title>
      <ErrorView error={error} retry={retry} />
    </>
  );
}
