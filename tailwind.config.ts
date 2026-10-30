import type { Config } from "tailwindcss";

/**
 * El branding es POR TENANT y dinámico. Por eso los colores semánticos
 * apuntan a variables CSS que el layout del tenant inyecta en runtime
 * (ver TenantProvider). Los valores por defecto viven en globals.css.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        surface2: "var(--color-surface-2)",
        surface3: "var(--color-surface-3)",
        primary: "var(--color-primary)",
        "primary-soft": "var(--color-primary-soft)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",
        danger: "var(--color-danger)",
        success: "var(--color-success)",
        info: "var(--color-info)",
      },
      fontFamily: {
        sans: ["var(--font-lato)", "system-ui", "sans-serif"],
        display: ["var(--font-anton)", "var(--font-lato)", "sans-serif"],
      },
      /**
       * Elevacion Material Design 3 adaptada a tema oscuro: en superficies
       * oscuras el "lift" se percibe sobre todo por tinte de superficie
       * (surface/surface2/surface3) mas una sombra negra sutil. Usamos negro
       * con alpha (color real) porque los modificadores de opacidad NO
       * compilan sobre tokens en variables CSS.
       */
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.30)",
        "card-hover": "0 10px 28px -6px rgb(0 0 0 / 0.50)",
        sheet: "0 -12px 32px -8px rgb(0 0 0 / 0.55)",
        bar: "0 -6px 20px -8px rgb(0 0 0 / 0.45)",
      },
      keyframes: {
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in-left": "slide-in-left 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
