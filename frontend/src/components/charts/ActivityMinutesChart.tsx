import { max } from "d3-array";
import { scaleLinear } from "d3-scale";
import type { ActivityProgressDay } from "../../types/index.js";
import { chartDayLabel } from "../../utils/formatters.js";

export function ActivityMinutesChart({
  data,
}: {
  data: ActivityProgressDay[];
}) {
  const width = 700;
  const height = 270;
  const x = scaleLinear()
    .domain([0, Math.max(data.length - 1, 1)])
    .range([72, width - 32]);
  const maxMinutes = max(data, (entry) => Number(entry.activity_minutes)) ?? 0;
  const y = scaleLinear()
    .domain([0, Math.max(maxMinutes, 60)])
    .nice(4)
    .range([height - 42, 30]);
  const barWidth = Math.min(42, (width - 104) / Math.max(data.length, 1) / 2);

  return (
    <article className="surface activity-chart-card">
      <div className="activity-chart-heading">
        <div>
          <p className="eyebrow">MOVEMENT</p>
          <h3>Active minutes</h3>
        </div>
        <span className="chart-legend">
          <i className="activity-legend-mark" /> Activity
        </span>
      </div>
      <svg
        className="activity-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Bar chart showing activity minutes by day for the last seven days"
      >
        <defs>
          <linearGradient
            id="activity-bar-gradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#e97555" />
            <stop offset="100%" stopColor="#b74732" />
          </linearGradient>
          <linearGradient id="activity-bar-side-gradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#983b2d" />
            <stop offset="100%" stopColor="#7f3027" />
          </linearGradient>
          <linearGradient
            id="activity-bar-top-gradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#f8a17e" />
            <stop offset="100%" stopColor="#df684a" />
          </linearGradient>
        </defs>
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line
              className="activity-chart-gridline"
              x1={56}
              x2={width - 20}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="activity-chart-axis" x={48} y={y(tick) + 4}>
              {tick}
            </text>
          </g>
        ))}
        {data.map((entry, index) => {
          const minutes = Number(entry.activity_minutes);
          const barHeight = Math.max(0, y(0) - y(minutes));
          const xPosition = x(index) - barWidth / 2;
          const depth = Math.min(7, barWidth * 0.22);
          return (
            <g key={entry.summary_date}>
              {barHeight > 0 && (
                <>
                  <polygon
                    className="activity-chart-bar-side"
                    points={`${xPosition + barWidth},${y(minutes)} ${xPosition + barWidth + depth},${y(minutes) - depth} ${xPosition + barWidth + depth},${y(0) - depth} ${xPosition + barWidth},${y(0)}`}
                  />
                  <polygon
                    className="activity-chart-bar-top"
                    points={`${xPosition},${y(minutes)} ${xPosition + depth},${y(minutes) - depth} ${xPosition + barWidth + depth},${y(minutes) - depth} ${xPosition + barWidth},${y(minutes)}`}
                  />
                </>
              )}
              <rect
                className="activity-chart-bar"
                x={xPosition}
                y={y(minutes)}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2}
                fill="url(#activity-bar-gradient)"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <title>{`${chartDayLabel(entry.summary_date)}: ${minutes} active minutes`}</title>
              </rect>
              {minutes > 0 && (
                <text
                  className="activity-chart-value"
                  x={x(index)}
                  y={y(minutes) - 9}
                  textAnchor="middle"
                >
                  {minutes}
                </text>
              )}
              <text
                className="activity-chart-day"
                x={x(index)}
                y={height - 14}
                textAnchor="middle"
              >
                {chartDayLabel(entry.summary_date)}
              </text>
            </g>
          );
        })}
      </svg>
    </article>
  );
}
