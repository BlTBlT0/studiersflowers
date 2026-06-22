export interface HourlyWeather {
  date: string;
  hour: number;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
}

export interface WeatherForecast {
  source: "open-meteo" | "mock";
  hours: HourlyWeather[];
  message?: string;
}

export interface WeatherImpact {
  kind: "neutral" | "outdoor" | "indoor" | "heat";
  adjustment: number;
  reason: string;
  temperature?: number;
  precipitation?: number;
  windSpeed?: number;
}

function mockForecast(start = new Date()): WeatherForecast {
  const hours: HourlyWeather[] = [];
  for (let day = 0; day < 14; day++) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);
    const dateStr = date.toISOString().slice(0, 10);
    for (let hour = 7; hour <= 22; hour++) {
      const warmDay = day % 4 === 1;
      const rainyDay = day % 4 === 3;
      hours.push({
        date: dateStr,
        hour,
        temperature: warmDay ? 22 + Math.max(0, 8 - Math.abs(14 - hour)) : 16 + Math.max(0, 4 - Math.abs(14 - hour) / 2),
        precipitation: rainyDay && hour >= 12 ? 2.5 : 0,
        windSpeed: rainyDay ? 28 : 10,
        weatherCode: rainyDay ? 61 : warmDay ? 0 : 2,
      });
    }
  }
  return { source: "mock", hours, message: "Voorbeeldweer wordt gebruikt." };
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Locatie wordt niet ondersteund door dit apparaat."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 30 * 60 * 1000,
    });
  });
}

export async function loadWeatherForecast(enabled: boolean): Promise<WeatherForecast> {
  if (!enabled || typeof navigator === "undefined") return mockForecast();

  try {
    const position = await getPosition();
    const params = new URLSearchParams({
      latitude: position.coords.latitude.toString(),
      longitude: position.coords.longitude.toString(),
      hourly: "temperature_2m,precipitation,weather_code,wind_speed_10m",
      forecast_days: "14",
      timezone: "auto",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("Weerservice is tijdelijk niet beschikbaar.");
    const data = await response.json();
    const hours: HourlyWeather[] = data.hourly.time.map((time: string, index: number) => {
      const timestamp = new Date(time);
      return {
        date: time.slice(0, 10),
        hour: timestamp.getHours(),
        temperature: data.hourly.temperature_2m[index],
        precipitation: data.hourly.precipitation[index],
        windSpeed: data.hourly.wind_speed_10m[index],
        weatherCode: data.hourly.weather_code[index],
      };
    });
    return { source: "open-meteo", hours };
  } catch (error) {
    return {
      ...mockForecast(),
      message: error instanceof Error ? `${error.message} Voorbeeldweer wordt gebruikt.` : "Voorbeeldweer wordt gebruikt.",
    };
  }
}

export function getWeatherImpact(
  forecast: WeatherForecast | undefined,
  date: string,
  hour: number,
  priorityScore: number,
  outdoorPreference: string
): WeatherImpact {
  const weather = forecast?.hours.find((item) => item.date === date && item.hour === hour);
  if (!weather) return { kind: "neutral", adjustment: 0, reason: "" };

  if (weather.temperature >= 30 && hour >= 12 && hour < 17 && priorityScore < 80) {
    return {
      kind: "heat",
      adjustment: -30,
      reason: `Zware studie is vermeden tijdens de hitte (${Math.round(weather.temperature)}°C).`,
      ...weather,
    };
  }
  if (weather.precipitation >= 1 || weather.windSpeed >= 35) {
    return {
      kind: "indoor",
      adjustment: 8,
      reason: "Slecht weer maakt dit een geschikt moment voor een langer binnenblok.",
      ...weather,
    };
  }
  if (
    weather.temperature >= 24 &&
    weather.precipitation < 0.5 &&
    weather.weatherCode <= 2 &&
    outdoorPreference !== "low"
  ) {
    return {
      kind: "outdoor",
      adjustment: hour < 12 ? 15 : -10,
      reason: hour < 12
        ? "Belangrijk werk staat vroeg, zodat er later tijd buiten overblijft."
        : "Mooi weer maakt vrije tijd later op de dag aantrekkelijk.",
      ...weather,
    };
  }
  return {
    kind: "neutral",
    adjustment: 0,
    reason: "",
    ...weather,
  };
}

export { mockForecast };
