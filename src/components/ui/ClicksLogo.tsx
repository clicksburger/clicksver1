import Image from "next/image";

/** Logo original incluido por Clicks en el repositorio. */
export function ClicksLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/img/clickslogo.jpg"
      alt="Clicks Burger"
      width={525}
      height={200}
      className={`clicks-logo ${className}`}
      priority
    />
  );
}
