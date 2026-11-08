"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Instagram, ShoppingBag, Store, UtensilsCrossed, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ClicksLogo } from "@/components/ui/ClicksLogo";
import { groupByCategoria } from "../mappers";
import { MenuItemCard } from "./MenuItemCard";
import { CartPanel } from "./CartPanel";
import { PromoCarousel } from "./PromoCarousel";
import { PedidoEnCurso } from "./PedidoEnCurso";
import { useModoMostrador } from "@/features/orders/mostrador";
import { unirPromosConHamburguesas } from "../promos";
import type { SlideCarrusel } from "../carrusel";
import { Sheet } from "@/components/ui";
import { cartCount, cartTotal, useCartStore } from "../store/cart.store";
import { estaAbierto, DIAS } from "@/features/tenants/horarios";
import { formatPrecio } from "@/lib/format";
import { routes } from "@/constants/routes";
import type { MenuItem, Tenant } from "@/types/domain";
import "./menu-brand.css";

/** Mascotas de la carta impresa de Clicks, por categoría. */
const MASCOTAS = {
  burger: { src: "/img/mascota-burger.png", w: 420, h: 387 },
  papas: { src: "/img/mascota-papas.png", w: 420, h: 443 },
} as const;
function mascotaDe(categoria: string) {
  const c = categoria.toLowerCase();
  if (c.includes("hamburgues")) return MASCOTAS.burger;
  if (c.includes("extra") || c.includes("papa")) return MASCOTAS.papas;
  return null;
}

export function MenuClient({
  tenant,
  items,
  slides,
  resaltados,
}: {
  tenant: Tenant;
  items: MenuItem[];
  /** Carrusel del día (armado en el servidor según el modo que eligió el local). */
  slides: SlideCarrusel[];
  /** Productos de la promo del día activa: su tarjeta se resalta en la grilla. */
  resaltados: string[];
}) {
  const groups = useMemo(() => unirPromosConHamburguesas(groupByCategoria(items)), [items]);
  const addToCart = useCartStore((state) => state.add);
  /** "Elegí tu burger" apunta a Hamburguesas aunque Promociones vaya primero. */
  const burgersIndex = Math.max(
    0,
    groups.findIndex((group) => group.categoria.toLowerCase().includes("hamburgues")),
  );
  const count = useCartStore((state) => cartCount(state.lines));
  const total = useCartStore((state) => cartTotal(state.lines));
  const [open, setOpen] = useState(true);
  const mostrador = useModoMostrador();
  const [cartOpen, setCartOpen] = useState(false);
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, groups.length - 1));
  const navRef = useRef<HTMLElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const check = () => setOpen(estaAbierto(tenant.horarios));
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [tenant.horarios]);
  const motion = (): ScrollBehavior =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: motion(), block: "start" });
  /** Centra el botón activo en la tira de categorías (solo mueve el eje horizontal). */
  function revealButton(index: number) {
    const box = buttonsRef.current;
    const button = box?.children[index] as HTMLElement | undefined;
    if (!box || !button || box.scrollWidth <= box.clientWidth) return;
    const boxRect = box.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    box.scrollTo({
      left: box.scrollLeft + rect.left - boxRect.left - (box.clientWidth - rect.width) / 2,
      behavior: motion(),
    });
  }
  function choose(index: number) {
    const products = productsRef.current;
    if (products) {
      // Inicio de la grilla, debajo de la barra sticky de categorías.
      const navHeight = navRef.current?.offsetHeight ?? 0;
      const top = Math.max(
        0,
        products.getBoundingClientRect().top + window.scrollY - navHeight - 12,
      );
      if (window.scrollY > top + 4) {
        // Subiendo: el salto va antes del cambio. Si la categoría nueva es más
        // corta, la página se achica y un scroll suave en curso pegaba un tirón.
        window.scrollTo({ top, behavior: index === activeIndex ? motion() : "instant" });
      } else if (window.scrollY < top - 4) {
        window.scrollTo({ top, behavior: motion() });
      }
    }
    setActive(index);
    revealButton(index);
  }
  /** Lleva la vista a la tarjeta del producto (al venir del carrusel) y la ilumina un momento. */
  function spotlight(id: string) {
    requestAnimationFrame(() => {
      const card = document.getElementById(`producto-${id}`);
      if (!card) return;
      card.scrollIntoView({ behavior: motion(), block: "center" });
      card.classList.remove("is-spotlight");
      void card.offsetWidth; // reinicia la animación si se repite
      card.classList.add("is-spotlight");
      setTimeout(() => card.classList.remove("is-spotlight"), 2200);
    });
  }
  function showCart() {
    if (window.matchMedia("(min-width: 1200px)").matches) scrollTo("clicks-cart");
    else setCartOpen(true);
  }
  return (
    <div className="clicks-menu">
      <header className="cm-header">
        <div className="cm-header-inner">
          <a href="#" aria-label="Clicks Burger, inicio">
            <ClicksLogo />
          </a>
          <span className={`cm-open ${open ? "is-open" : ""}`}>
            <i aria-hidden="true" />
            {open ? "Estamos tomando pedidos" : "Volvemos en nuestro horario"}
          </span>
          <div className="cm-header-links">
            <a
              href="https://www.instagram.com/clicksburger/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram de Clicks Burger"
            >
              <Instagram size={19} />
              <span>@clicksburger</span>
            </a>
            <button
              type="button"
              onClick={showCart}
              aria-label={`Ver pedido, ${count} ${count === 1 ? "producto" : "productos"}`}
            >
              <ShoppingBag size={18} />
              <span>Tu pedido</span>
              <b key={count}>{count}</b>
            </button>
          </div>
        </div>
      </header>
      {mostrador.activo ? (
        <div className="cm-mostrador-bar" role="status">
          <Store size={18} aria-hidden="true" />
          <p>
            <strong>Modo mostrador.</strong> Los pedidos entran directo a la caja, sin WhatsApp.
          </p>
          <button type="button" onClick={mostrador.salir}>
            <X size={15} aria-hidden="true" /> Salir
          </button>
        </div>
      ) : (
        <PedidoEnCurso />
      )}
      <section className="cm-hero" aria-label="Clicks Burger">
        <div className="cm-hero-photo-wrap">
          <Image
            src="/img/crispy-clicks.png"
            alt="Crispy Clicks con cheddar, bacon y cebolla crispy"
            fill
            sizes="(max-width: 700px) 100vw, 58vw"
            priority
            className="cm-hero-photo"
          />
          <span className="cm-photo-caption">Crispy Clicks</span>
        </div>
        <div className="cm-hero-shade" aria-hidden="true" />
        <div className="cm-hero-inner">
          <div className="cm-hero-copy">
            <p>Hechas para ese antojo.</p>
            <h1>
              Hoy se come
              <br />
              Clicks.
            </h1>
            <div className="cm-hero-bottom">
              <button type="button" onClick={() => choose(burgersIndex)} className="cm-hero-cta">
                Elegí tu burger <ArrowDown size={19} />
              </button>
              <span>
                Simple, doble o triple.
                <br />
                Todas con papas.
              </span>
            </div>
          </div>
        </div>
      </section>
      <div className="cm-brand-strip" aria-hidden="true" />
      <PromoCarousel
        slides={slides}
        onAdd={(item) =>
          addToCart({
            itemId: item.id,
            nombre: item.nombre,
            variante: null,
            precio: item.precio ?? 0,
          })
        }
        onShow={(item) => {
          choose(
            Math.max(
              0,
              groups.findIndex((group) => group.items.some((i) => i.id === item.id)),
            ),
          );
          spotlight(item.id);
        }}
      />
      <nav
        ref={navRef}
        className="cm-category-nav"
        aria-label="Categorías del menú"
        id="clicks-menu-area"
      >
        <div className="cm-category-inner">
          <div className="cm-category-buttons" ref={buttonsRef}>
            {groups.map((category, index) => (
              <button
                key={category.categoria}
                type="button"
                aria-pressed={index === activeIndex}
                aria-controls="clicks-products"
                onClick={() => choose(index)}
              >
                {category.categoria}
                <span>{category.items.length}</span>
              </button>
            ))}
          </div>
          <span className="cm-menu-caption">Tu antojo, a un click.</span>
        </div>
      </nav>
      <div className="cm-content">
        {!open && (
          <details className="cm-hours">
            <summary>Estamos cerrados. Podés mirar la carta y consultar los horarios.</summary>
            <ul>
              {tenant.horarios?.length ? (
                tenant.horarios.map((day) => (
                  <li key={day.dia}>
                    <strong>{DIAS[day.dia]}</strong>
                    <span>{day.abierto ? `${day.abre} a ${day.cierra}` : "Cerrado"}</span>
                  </li>
                ))
              ) : (
                <li>Los horarios todavía no están publicados.</li>
              )}
            </ul>
          </details>
        )}
        <div className="cm-order-layout">
          <main
            ref={productsRef}
            id="clicks-products"
            className="cm-products"
            aria-label="Productos de la categoría"
          >
            {/* Todas las categorías quedan montadas y solo se ocultan: cambiar de
                botón no vuelve a crear las tarjetas ni a decodificar las fotos. */}
            {groups.length ? (
              groups.map((group, index) => (
                <section
                  key={group.categoria}
                  hidden={index !== activeIndex}
                  className="cm-category-content"
                >
                  <header className="cm-section-heading">
                    <div>
                      <p>La carta de Clicks</p>
                      <h2>{group.categoria}</h2>
                    </div>
                    {(() => {
                      const mascota = mascotaDe(group.categoria);
                      return mascota ? (
                        <Image
                          src={mascota.src}
                          alt=""
                          aria-hidden="true"
                          width={mascota.w}
                          height={mascota.h}
                          sizes="(max-width: 700px) 64px, 104px"
                          className="cm-section-mascot"
                        />
                      ) : null;
                    })()}
                    <span>
                      {group.categoria.toLowerCase().includes("hamburgues")
                        ? "Todas incluyen papas"
                        : group.categoria.toLowerCase().includes("bebida")
                          ? "Bien frías. Como tienen que estar."
                          : "El acompañamiento también cuenta."}
                    </span>
                  </header>
                  <div className="cm-product-grid">
                    {group.items.map((item) => (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        layout="compact"
                        resaltada={resaltados.includes(item.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="cm-empty">
                <UtensilsCrossed size={35} />
                <h2>Estamos preparando la carta.</h2>
                <p>Volvé a consultar el menú en un momento.</p>
              </div>
            )}
          </main>
          <aside className="cm-cart-aside" id="clicks-cart" aria-label="Resumen de tu pedido">
            <CartPanel tenant={tenant} cerrado={!open} mostrador={mostrador.activo} />
          </aside>
        </div>
      </div>
      <footer className="cm-footer">
        <div className="cm-footer-inner">
          <div className="cm-footer-brand">
            <Image
              src={MASCOTAS.burger.src}
              alt=""
              aria-hidden="true"
              width={MASCOTAS.burger.w}
              height={MASCOTAS.burger.h}
              sizes="120px"
              className="cm-footer-mascot"
            />
            <div>
              <ClicksLogo />
              <p>El gusto de volver.</p>
            </div>
          </div>
          <div className="cm-footer-links">
            <a
              href="https://www.instagram.com/clicksburger/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={18} /> Seguinos en Instagram
            </a>
            <button type="button" onClick={() => choose(0)}>
              Volver al menú <ArrowDown size={16} />
            </button>
            <Link href={routes.login(tenant.slug)}>Equipo Clicks</Link>
          </div>
        </div>
      </footer>
      {count > 0 && (
        <div className="cm-floating-cart">
          <button type="button" onClick={() => setCartOpen(true)}>
            <span>
              <ShoppingBag size={20} />
              <b key={count}>{count}</b> Ver pedido
            </span>
            <strong>{formatPrecio(total)}</strong>
          </button>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        Tu pedido tiene {count} {count === 1 ? "producto" : "productos"}.
      </p>
      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title="Tu pedido"
        className="cm-cart-sheet"
      >
        <CartPanel tenant={tenant} cerrado={!open} showTitle={false} mostrador={mostrador.activo} />
      </Sheet>
    </div>
  );
}
