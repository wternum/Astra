// Vector redraw of the Astra logo: two nebula-filled blades meeting at a star.
// Static by design — no particles or motion.
export default function BrandMark() {
  const left = "M50 10C36 34 22 66 11.2 91.8C25 80 40 66 47.4 48C49.2 40 49.7 25 49.7 12Z";
  const stars: [number, number, number][] = [
    [42, 22, 0.45], [38, 33, 0.38], [44, 41, 0.5], [31, 52, 0.42], [37, 60, 0.4], [28, 64, 0.5],
    [33, 74, 0.4], [24, 80, 0.38], [19, 86, 0.34], [46, 56, 0.36], [40, 68, 0.34], [47, 30, 0.34],
  ];
  return (
    <span className="astra-mark" aria-hidden="true">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="astra-body" x1="50" y1="8" x2="14" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2b2a5c" />
            <stop offset=".45" stopColor="#15183f" />
            <stop offset="1" stopColor="#0a0d28" />
          </linearGradient>
          <linearGradient id="astra-rim" x1="50" y1="8" x2="50" y2="94" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".55" stopColor="#c4c8e2" />
            <stop offset="1" stopColor="#8e93b8" />
          </linearGradient>
          <radialGradient id="astra-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(40 56) scale(14 10)">
            <stop offset="0" stopColor="#ffe9c9" />
            <stop offset=".35" stopColor="#c9a7d6" stopOpacity=".75" />
            <stop offset="1" stopColor="#4a3f8a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="astra-arm" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(40 56) scale(22 15)">
            <stop offset="0" stopColor="#8f86d6" stopOpacity=".55" />
            <stop offset="1" stopColor="#2d3a8c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="astra-apex" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 8) scale(7)">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".3" stopColor="#ffe6c4" stopOpacity=".7" />
            <stop offset="1" stopColor="#b9a8ff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="astra-clip-left"><path d={left} /></clipPath>
        </defs>

        <g>
          <path d={left} fill="url(#astra-body)" />
          <g clipPath="url(#astra-clip-left)">
            <ellipse cx="40" cy="56" rx="22" ry="15" transform="rotate(-24 40 56)" fill="url(#astra-arm)" />
            <path d="M26 60C30 46 46 42 52 52C46 47 36 49 32 58C30 62 32 66 36 67" stroke="#cfc4f2" strokeWidth=".7" strokeLinecap="round" opacity=".5" />
            <path d="M28 66C34 70 44 66 46 58" stroke="#a9a1e6" strokeWidth=".6" strokeLinecap="round" opacity=".45" />
            <ellipse cx="40" cy="56" rx="14" ry="10" transform="rotate(-24 40 56)" fill="url(#astra-core)" />
            <circle cx="40" cy="56" r="1.5" fill="#fff4de" />
            {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? "#ffe3b8" : "#ffffff"} opacity=".9" />)}
          </g>
          <path d={left} stroke="url(#astra-rim)" strokeWidth=".9" strokeLinejoin="round" />
        </g>

        <g transform="translate(100 0) scale(-1 1)">
          <path d={left} fill="url(#astra-body)" />
          <g clipPath="url(#astra-clip-left)">
            <ellipse cx="40" cy="56" rx="22" ry="15" transform="rotate(-24 40 56)" fill="url(#astra-arm)" />
            <path d="M26 60C30 46 46 42 52 52C46 47 36 49 32 58C30 62 32 66 36 67" stroke="#cfc4f2" strokeWidth=".7" strokeLinecap="round" opacity=".5" />
            <path d="M28 66C34 70 44 66 46 58" stroke="#a9a1e6" strokeWidth=".6" strokeLinecap="round" opacity=".45" />
            <ellipse cx="40" cy="56" rx="14" ry="10" transform="rotate(-24 40 56)" fill="url(#astra-core)" />
            <circle cx="40" cy="56" r="1.5" fill="#fff4de" />
            {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 1 ? "#ffe3b8" : "#ffffff"} opacity=".9" />)}
          </g>
          <path d={left} stroke="url(#astra-rim)" strokeWidth=".9" strokeLinejoin="round" />
        </g>

        <circle cx="50" cy="8" r="7" fill="url(#astra-apex)" />
        <path d="M50 1.5V14.5M43.5 8H56.5" stroke="#e0bd78" strokeWidth=".9" strokeLinecap="round" />
        <circle cx="50" cy="8" r="1.4" fill="#fff3d6" stroke="#e0bd78" strokeWidth=".4" />
      </svg>
    </span>
  );
}
