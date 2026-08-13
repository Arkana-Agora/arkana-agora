import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

describe("cn", () => {
  it("une duas classes simples", () => {
    expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
  });

  it("resolve conflito de classes tailwind com tailwind-merge", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("ignora valores falsy", () => {
    expect(cn("px-2", false, null, undefined, "")).toBe("px-2");
  });

  it("mescla strings com objetos condicionais", () => {
    const isActive = true;
    expect(cn("base", { "opacity-50": !isActive, "font-bold": isActive })).toBe(
      "base font-bold",
    );
  });
});

describe("buttonVariants", () => {
  it("aplica a variante primária por padrão", () => {
    expect(buttonVariants()).toContain("bg-primary");
  });

  it("aplica a variante outline", () => {
    expect(buttonVariants({ variant: "outline" })).toContain("border-border");
    expect(buttonVariants({ variant: "outline" })).toContain("dark:border-input");
  });

  it("aplica o tamanho lg", () => {
    expect(buttonVariants({ size: "lg" })).toContain("h-9");
  });

  it("aceita className adicional", () => {
    expect(buttonVariants({ className: "mt-4" })).toContain("mt-4");
  });
});
