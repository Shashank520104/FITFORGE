import { extent, max } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import type { Measurement } from "../../types/index.js";
import {
  dateOnly,
  displayWeight,
  localDateAtNoon,
  weightInDisplayUnits,
} from "../../utils/formatters.js";

export function TrendChart({
  data,
  units,
}: {
  data: Measurement[];
  units: "metric" | "imperial";
}) {
  const filtered = data;
  if (!filtered.length)
    return (
      <div className="chart-empty">
        Add body measurements to see a trend here.
      </div>
    );
  const width = 680;
  const height = 240;
  const margin = { top: 18, right: 20, bottom: 38, left: 46 };
  const dates = filtered.map((row) => localDateAtNoon(row.measured_on));
  const values = filtered.map((row) =>
    weightInDisplayUnits(Number(row.weight_kg), units),
  );
  const dateExtent = extent(dates) as [Date, Date];
  if (dateExtent[0].getTime() === dateExtent[1].getTime()) {
    dateExtent[0] = new Date(dateExtent[0].getTime() - 86400000);
    dateExtent[1] = new Date(dateExtent[1].getTime() + 86400000);
  }
  const minValue = Math.min(...values);
  const maxValue = max(values) ?? minValue;
  const padding = Math.max((maxValue - minValue) * 0.2, 1);
  const x = scaleTime()
    .domain(dateExtent)
    .range([margin.left, width - margin.right]);
  const y = scaleLinear()
    .domain([minValue - padding, maxValue + padding])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const draw = line<Measurement>()
    .x((row) => x(localDateAtNoon(row.measured_on)))
    .y((row) => y(weightInDisplayUnits(Number(row.weight_kg), units)))
    .curve(curveMonotoneX);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Body weight measurements over time"
      >
        {y.ticks(4).map((tick) => (
          <g key={tick}>
            <line
              className="chart-grid"
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="chart-label"
              x={margin.left - 9}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {tick}
            </text>
          </g>
        ))}
        <path className="chart-line-depth" d={draw(filtered) ?? ""} />
        <path className="chart-line" d={draw(filtered) ?? ""} />
        {filtered.map((row) => (
          <g key={row.measured_on}>
            <circle
              className="chart-point-depth"
              cx={x(localDateAtNoon(row.measured_on))}
              cy={y(weightInDisplayUnits(Number(row.weight_kg), units))}
              r="4"
              transform="translate(0 6)"
            />
            <circle
              className="chart-point"
              cx={x(localDateAtNoon(row.measured_on))}
              cy={y(weightInDisplayUnits(Number(row.weight_kg), units))}
              r="4"
            >
              <title>{`${dateOnly(row.measured_on)}: ${displayWeight(Number(row.weight_kg), units)} ${units === "metric" ? "kg" : "lb"}`}</title>
            </circle>
          </g>
        ))}
        <text className="chart-label" x={margin.left} y={height - 10}>
          {dateExtent[0].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
        <text
          className="chart-label"
          x={width - margin.right}
          y={height - 10}
          textAnchor="end"
        >
          {dateExtent[1].toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      </svg>
      <p className="chart-caption">
        Weight · {units === "metric" ? "kg" : "lb"} · {filtered.length}{" "}
        measurements in this range
      </p>
      <table className="sr-table">
        <caption>Weight measurement data</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Weight ({units === "metric" ? "kg" : "lb"})</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.measured_on}>
              <td>{dateOnly(row.measured_on)}</td>
              <td>{displayWeight(Number(row.weight_kg), units)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
