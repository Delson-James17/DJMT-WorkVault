// src/components/Weather.tsx
import React, { useEffect, useState } from "react";

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
}

export const Weather: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      const city = import.meta.env.VITE_OPENWEATHERMAP_CITY;
      const apiKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;

      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`
        );
        const data = await res.json();

        setWeather({
          temp: data.main.temp,
          description: data.weather[0].description,
          icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}.png`,
        });
      } catch (err) {
        console.error("Failed to fetch weather:", err);
      }
    };

    fetchWeather();
  }, []);

  if (!weather) return <div>Loading weather...</div>;

  return (
    <div className="p-3 border rounded bg-light mb-3" style={{ maxWidth: 250 }}>
      <h5>Weather Forecast</h5>
      <img src={weather.icon} alt={weather.description} />
      <div>{weather.temp} °C</div>
      <div style={{ textTransform: "capitalize" }}>{weather.description}</div>
    </div>
  );
};
