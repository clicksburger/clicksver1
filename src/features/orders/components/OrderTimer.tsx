"use client";

import { useEffect, useState } from "react";

function fmt(totalSeg: number): string {
  const m = Math.floor(totalSeg / 60);
  const s = totalSeg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function OrderTimer({ desde, className }: { desde: string; className?: string }) {
  const [seg, setSeg] = useState(() => Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000)));

  useEffect(() => {
    const id = setInterval(
      () => setSeg(Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 1000))),
      1000,
    );
    return () => clearInterval(id);
  }, [desde]);

  return <span className={className}>{fmt(seg)}</span>;
}
