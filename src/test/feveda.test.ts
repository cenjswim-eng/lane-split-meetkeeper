import { describe, expect, it } from "vitest";
import { isFevedaUrl, isFevedaDirectoryUrl, parseFevedaDirectory } from "@/lib/feveda";

describe("feveda", () => {
  it("identifies feveda and natacionvenezuela domains", () => {
    expect(isFevedaUrl("https://feveda.org/resultados/")).toBe(true);
    expect(isFevedaUrl("https://natacionvenezuela.com/2026/occidente/")).toBe(true);
    expect(isFevedaUrl("https://example.com/meet/")).toBe(false);
  });

  it("identifies directory URLs vs specific meet URLs", () => {
    expect(isFevedaDirectoryUrl("https://feveda.org/resultados/")).toBe(true);
    expect(isFevedaDirectoryUrl("https://feveda.org/resultados")).toBe(true);
    expect(isFevedaDirectoryUrl("https://feveda.org/resultados-2025/")).toBe(true);
    expect(isFevedaDirectoryUrl("https://feveda.org/2026/regionalcentro/")).toBe(false);
    expect(isFevedaDirectoryUrl("https://natacionvenezuela.com/2026/occidente/")).toBe(false);
  });

  it("extracts meets from JSON-LD schema itemList", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "ItemList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "item": {
                      "@type": "SportsEvent",
                      "name": "Campeonato Regional Central 2026",
                      "startDate": "2026-04-15",
                      "endDate": "2026-04-19",
                      "location": {
                        "@type": "Place",
                        "name": "Naciones Unidas",
                        "address": { "addressRegion": "Caracas" }
                      },
                      "url": "https://feveda.org/2026/regionalcentro/"
                    }
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "item": {
                      "@type": "SportsEvent",
                      "name": "Campeonato Regional Occidente 2026",
                      "startDate": "2026-04-14",
                      "endDate": "2026-04-18",
                      "location": {
                        "@type": "Place",
                        "name": "ADAEF",
                        "address": { "addressRegion": "Falcón" }
                      },
                      "url": "https://natacionvenezuela.com/2026/occidente/"
                    }
                  }
                ]
              }
            ]
          }
          </script>
        </head>
      </html>
    `;

    const meets = parseFevedaDirectory(html);
    expect(meets).toHaveLength(2);
    expect(meets[0]).toEqual({
      name: "Campeonato Regional Central 2026",
      startDate: "2026-04-15",
      endDate: "2026-04-19",
      location: "Naciones Unidas (Caracas)",
      url: "https://feveda.org/2026/regionalcentro/",
      description: undefined,
    });
    expect(meets[1]).toEqual({
      name: "Campeonato Regional Occidente 2026",
      startDate: "2026-04-14",
      endDate: "2026-04-18",
      location: "ADAEF (Falcón)",
      url: "https://natacionvenezuela.com/2026/occidente/",
      description: undefined,
    });
  });

  it("extracts fallback meets from anchor links when no JSON-LD is available", () => {
    const html = `
      <div>
        <a href="https://feveda.org/2026/infantil/">Ver resultados · Campeonato Nacional Infantil 2026</a>
        <a href="https://feveda.org/2026/juvenil/">RESULTADOS EN VIVO · Campeonato Nacional Juvenil 2026</a>
      </div>
    `;
    const meets = parseFevedaDirectory(html);
    expect(meets).toHaveLength(2);
    expect(meets[0]?.name).toContain("Campeonato Nacional Infantil 2026");
    expect(meets[0]?.url).toBe("https://feveda.org/2026/infantil/");
  });
});
