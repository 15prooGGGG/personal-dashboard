import { weather } from '../data/mock.ts'

export default function WeatherModule() {
  return (
    <div className="weather">
      <div className="weather__now">
        <span className="weather__temp data">{weather.tempC}°</span>
        <div className="weather__meta">
          <p className="weather__cond">{weather.condition}</p>
          <p className="muted">
            Gefühlt {weather.feelsLikeC}° · {weather.precipitationProbability}% Regen
          </p>
          <p className="muted data">
            <span className="is-up">↑{weather.highC}°</span>{' '}
            <span className="is-down">↓{weather.lowC}°</span>
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
