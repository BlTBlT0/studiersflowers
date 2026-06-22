import { describe, expect, it } from "vitest";
import { getWeatherImpact, loadWeatherForecast, type WeatherForecast } from "@/lib/weather";

const forecast: WeatherForecast = {
  source: "mock",
  hours: [
    { date: "2026-06-22", hour: 10, temperature: 27, precipitation: 0, windSpeed: 8, weatherCode: 0 },
    { date: "2026-06-22", hour: 14, temperature: 33, precipitation: 0, windSpeed: 8, weatherCode: 0 },
    { date: "2026-06-23", hour: 14, temperature: 17, precipitation: 3, windSpeed: 20, weatherCode: 61 },
  ],
};

describe("weather planning", () => {
  it("falls back to deterministic mock weather when location is unavailable", async () => {
    const result = await loadWeatherForecast(true);
    expect(result.source).toBe("mock");
    expect(result.hours.length).toBeGreaterThan(0);
  });

  it("prefers finishing early on a warm sunny day", () => {
    const impact = getWeatherImpact(forecast, "2026-06-22", 10, 70, "balanced");
    expect(impact.kind).toBe("outdoor");
    expect(impact.adjustment).toBeGreaterThan(0);
  });

  it("avoids non-urgent heavy work during extreme heat", () => {
    const impact = getWeatherImpact(forecast, "2026-06-22", 14, 60, "balanced");
    expect(impact.kind).toBe("heat");
    expect(impact.adjustment).toBeLessThan(0);
  });

  it("encourages indoor work in rain", () => {
    const impact = getWeatherImpact(forecast, "2026-06-23", 14, 60, "balanced");
    expect(impact.kind).toBe("indoor");
    expect(impact.adjustment).toBeGreaterThan(0);
  });
});
