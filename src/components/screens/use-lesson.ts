"use client";

import { useEffect, useState } from "react";

import type { Lesson } from "@/modules/content/service";

/** A lesson through the API (/api/v1/lessons/:page), for screens that pick the page on the device. */
export function useLesson(page: number | null, locale: string) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  useEffect(() => {
    if (page === null) return;
    let live = true;
    fetch(`/api/v1/lessons/${page}?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((l) => live && setLesson(l));
    return () => {
      live = false;
    };
  }, [page, locale]);
  return lesson?.bookPage === page ? lesson : null;
}
