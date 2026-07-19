import { weather } from '../data/mock.ts'

export default function WeatherModule() {
  return (
    <div>
      <div className="weather__now">
        <span className="weather__temp data">{weather.tempC}°</span>
        <div className="weather__meta">
          <p style={{ fontWeight: 500 }}>{weather.condition}</p>
          <p className="muted">
            Gefühlt {weather.feelsLikeC}° · {weather.precipitationProbability}% Regen
          </p>
          <p className="muted data">
            <span className="up">↑{weather.highC}°</span> <span className="down">↓{weather.lowC}°</span>
          </p>
        </div>
      </div>
      <ul className="weather__forecast">
        {weather.forecast.map((h) => (
          <li key={h.time}>
            <span className="muted data">{h.time}</span>
            <span className="data">{h.tempC}°</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
