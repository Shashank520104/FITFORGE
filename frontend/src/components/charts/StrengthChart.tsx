import { extent, max } from "d3-array";
import { scaleLinear, scaleTime } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import type { StrengthRecord } from "../../types/index.js";
import {
  dateOnly,
  displayWeight,
  localDateAtNoon,
  weightInDisplayUnits,
} from "../../utils/formatters.js";

export function StrengthChart({
  data,
  units,
}: {
  data: StrengthRecord[];
  units: "metric" | "imperial";
}) {
  if (!data.length)
    return (
      <div className="chart-empty">
        Log a strength record to see a trend here.
      </div>
    );
  const width = 680;
  const height = 240;
  const margin = { top: 18, right: 20, bottom: 38, left: 46 };
  const dates = data.map((row) => localDateAtNoon(row.performed_at));
  const values = data.map((row) =>
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
    .domain([Math.max(0, minValue - padding), maxValue + padding])
    .nice()
    .range([height - margin.bottom, margin.top]);
  const draw = line<StrengthRecord>()
    .x((row) => x(localDateAtNoon(row.performed_at)))
    .y((row) => y(weightInDisplayUnits(Number(row.weight_kg), units)))
    .curve(curveMonotoneX);

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Logged strength loads over time"
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
        <path className="chart-line-depth" d={draw(data) ?? ""} />
        <path className="chart-line" d={draw(data) ?? ""} />
        {data.map((row, index) => (
          <g key={`${row.performed_at}-${index}`}>
            <circle
              className="chart-point-depth"
              cx={x(localDateAtNoon(row.performed_at))}
              cy={y(weightInDisplayUnits(Number(row.weight_kg), units))}
              r="4"
              transform="translate(0 6)"
            />
            <circle
              className="chart-point"
              cx={x(localDateAtNoon(row.performed_at))}
              cy={y(weightInDisplayUnits(Number(row.weight_kg), units))}
              r="4"
            >
              <title>{`${dateOnly(row.performed_at)}: ${displayWeight(Number(row.weight_kg), units)} ${units === "metric" ? "kg" : "lb"} × ${row.repetitions}`}</title>
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
        Logged load · {units === "metric" ? "kg" : "lb"} · {data.length} records
      </p>
      <table className="sr-table">
        <caption>Strength load history</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Load ({units === "metric" ? "kg" : "lb"})</th>
            <th>Repetitions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${row.performed_at}-${index}`}>
              <td>{dateOnly(row.performed_at)}</td>
              <td>{displayWeight(Number(row.weight_kg), units)}</td>
              <td>{row.repetitions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
