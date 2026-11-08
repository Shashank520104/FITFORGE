import { max } from "d3-array";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import type { ActivityProgressDay } from "../../types/index.js";
import { chartDayLabel, formatNumber } from "../../utils/formatters.js";

export function SleepTrendChart({ data }: { data: ActivityProgressDay[] }) {
  const width = 700;
  const height = 270;
  const x = scaleLinear()
    .domain([0, Math.max(data.length - 1, 1)])
    .range([72, width - 32]);
  const maxSleepHours =
    max(data, (entry) => Number(entry.sleep_minutes) / 60) ?? 0;
  const y = scaleLinear()
    .domain([0, Math.max(maxSleepHours, 8)])
    .nice(4)
    .range([height - 42, 30]);
  const sleepLine = line<ActivityProgressDay>()
    .defined((entry) => Number(entry.sleep_count) > 0)
    .x((_entry, index) => x(index))
    .y((entry) => y(Number(entry.sleep_minutes) / 60))
    .curve(curveMonotoneX);

  return (
    <article className="surface activity-chart-card">
      <div className="activity-chart-heading">
        <div>
          <p className="eyebrow">REST</p>
          <h3>Sleep duration</h3>
        </div>
        <span className="chart-legend">
          <i className="sleep-legend-mark" /> Sleep
        </span>
      </div>
      <svg
        className="activity-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart showing sleep hours by night for the last seven days"
      >
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
              {tick}h
            </text>
          </g>
        ))}
        <path className="sleep-chart-line-depth" d={sleepLine(data) ?? ""} />
        <path className="sleep-chart-line" d={sleepLine(data) ?? ""} />
        {data.map((entry, index) => {
          const sleepHours = Number(entry.sleep_minutes) / 60;
          const hasSleep = Number(entry.sleep_count) > 0;
          return (
            <g key={entry.summary_date}>
              {hasSleep && (
                <>
                  <circle
                    className="sleep-chart-halo"
                    cx={x(index)}
                    cy={y(sleepHours)}
                    r={10}
                  />
                  <circle
                    className="sleep-chart-point"
                    cx={x(index)}
                    cy={y(sleepHours)}
                    r={4}
                  >
                    <title>{`${chartDayLabel(entry.summary_date)}: ${formatNumber(sleepHours)} hours of sleep`}</title>
                  </circle>
                  <text
                    className="activity-chart-value"
                    x={x(index)}
                    y={y(sleepHours) - 12}
                    textAnchor="middle"
                  >
                    {formatNumber(sleepHours)}h
                  </text>
                </>
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
