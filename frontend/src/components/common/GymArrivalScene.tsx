export function GymArrivalScene() {
  return (
    <svg
      className="gym-arrival-art"
      viewBox="0 0 640 360"
      role="img"
      aria-label="An animated barbell in a softly lit gym"
    >
      <defs>
        <linearGradient id="gym-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#284a40" />
          <stop offset="1" stopColor="#142b26" />
        </linearGradient>
        <linearGradient id="gym-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1c7a6" />
          <stop offset="1" stopColor="#d77658" />
        </linearGradient>
        <linearGradient id="gym-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#355b4d" />
          <stop offset="1" stopColor="#1c392f" />
        </linearGradient>
        <radialGradient id="gym-glow">
          <stop offset="0" stopColor="#e6a47e" stopOpacity=".3" />
          <stop offset="1" stopColor="#e6a47e" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="34"
        y="24"
        width="572"
        height="300"
        rx="28"
        fill="url(#gym-wall)"
      />
      <circle cx="320" cy="158" r="190" fill="url(#gym-glow)" />
      <path
        d="M34 238h572v58a28 28 0 0 1-28 28H62a28 28 0 0 1-28-28z"
        fill="url(#gym-floor)"
      />
      <path d="M78 80h100v104H78z" fill="#d9e9d8" fillOpacity=".08" />
      <path
        d="M128 80v104m-50-52h100"
        stroke="#d9e9d8"
        strokeOpacity=".1"
        strokeWidth="3"
      />
      <path
        d="M216 250V102m208 148V102m-208 22h208m-208 36h208"
        stroke="#8eb39a"
        strokeOpacity=".3"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M233 252V113m174 139V113"
        stroke="#a9c5ac"
        strokeOpacity=".55"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse
        cx="320"
        cy="264"
        rx="180"
        ry="24"
        fill="#0c201a"
        fillOpacity=".35"
      />
      <g className="gym-bench">
        <path
          d="m300 231-20 38m92-38 20 38"
          stroke="#d1b49c"
          strokeOpacity=".8"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M279 220h120a10 10 0 0 1 10 10v12H269v-12a10 10 0 0 1 10-10z"
          fill="#d67658"
        />
        <path
          d="M283 224h112"
          stroke="#f3b18d"
          strokeOpacity=".65"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g className="gym-barbell">
        <path
          d="M199 174h242"
          stroke="#dce8d9"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M217 147v54m14-66v78m178-78v78m14-66v54"
          stroke="url(#gym-steel)"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M245 174h150"
          stroke="#fff1df"
          strokeOpacity=".42"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <g className="gym-dumbbell">
        <path
          d="M470 240h90"
          stroke="#f2d6c3"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M479 226v28m11-35v42m41-42v42m11-35v28"
          stroke="url(#gym-steel)"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      <circle
        className="gym-spark gym-spark-one"
        cx="490"
        cy="100"
        r="4"
        fill="#f3bd98"
      />
      <circle
        className="gym-spark gym-spark-two"
        cx="540"
        cy="140"
        r="3"
        fill="#d9e8d6"
      />
      <circle
        className="gym-spark gym-spark-three"
        cx="140"
        cy="216"
        r="3"
        fill="#f3bd98"
      />
    </svg>
  );
}
