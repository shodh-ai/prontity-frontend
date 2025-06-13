export default async function Home() {
  return (
    <main className="w-screen h-screen flex items-center justify-center bg-black">
      <style>
        {`
                svg {
                    width: 100%;
                    height: 100%;
                    max-height: 70vh; /* Adjust height based on viewport */
                    border-radius: 0.75rem;
                    background-color: #010409; /* Even darker background for the SVG area */
                    box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.1);
                }
                .rocket-group {
                    transform-origin: center bottom;
                    animation: launch 3s ease-out forwards; /* Launch animation */
                }

                .projectile {
                    animation: projectileFly 2s ease-out forwards 1s; /* Projectile animation after rocket launch */
                    opacity: 0; /* Hidden initially */
                }

                @keyframes launch {
                    0% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-50px) scale(1.05); } /* Slight lift and scale */
                    100% { transform: translateY(-300px) scale(1.1); opacity: 1;} /* Move up and slightly scale */
                }

                @keyframes projectileFly {
                    0% { transform: translate(0, 0); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translate(150px, -200px); opacity: 1;} /* Fly up and right */
                }
                `}
      </style>
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet">
        {/* Background Stars */}
        <circle cx="50" cy="50" r="1" fill="#fff" opacity="0.8" />
        <circle cx="150" cy="120" r="0.8" fill="#fff" opacity="0.6" />
        <circle cx="280" cy="80" r="1.2" fill="#fff" opacity="0.9" />
        <circle cx="400" cy="150" r="0.7" fill="#fff" opacity="0.5" />
        <circle cx="550" cy="60" r="1.1" fill="#fff" opacity="0.7" />
        <circle cx="100" cy="200" r="0.9" fill="#fff" opacity="0.6" />
        <circle cx="350" cy="250" r="1.3" fill="#fff" opacity="1" />
        <circle cx="500" cy="300" r="0.6" fill="#fff" opacity="0.4" />

        {/* Planet Surface */}
        <defs>
          <linearGradient id="planetGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              style={{ stopColor: "#0A5C36", stopOpacity: 1 }}
            />{" "}
            {/* Dark Green */}
            <stop
              offset="50%"
              style={{ stopColor: "#2E8B57", stopOpacity: 1 }}
            />{" "}
            {/* Medium Sea Green */}
            <stop
              offset="100%"
              style={{ stopColor: "#4CAF50", stopOpacity: 1 }}
            />{" "}
            {/* Green */}
          </linearGradient>
          <linearGradient
            id="rocketBodyGradient"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              style={{ stopColor: "#A0A0A0", stopOpacity: 1 }}
            />{" "}
            {/* Light Grey */}
            <stop
              offset="100%"
              style={{ stopColor: "#606060", stopOpacity: 1 }}
            />{" "}
            {/* Dark Grey */}
          </linearGradient>
          <linearGradient id="flameGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop
              offset="0%"
              style={{ stopColor: "#FFD700", stopOpacity: 1 }}
            />{" "}
            {/* Gold */}
            <stop
              offset="50%"
              style={{ stopColor: "#FFA500", stopOpacity: 1 }}
            />{" "}
            {/* Orange */}
            <stop
              offset="100%"
              style={{ stopColor: "#FF4500", stopOpacity: 1 }}
            />{" "}
            {/* Orange Red */}
          </linearGradient>
        </defs>

        <ellipse
          cx="300"
          cy="450"
          rx="400"
          ry="200"
          fill="url(#planetGradient)"
        />

        {/* Rocket Group - applies launch animation */}
        <g className="rocket-group" transform="translate(0,0)">
          {/* Rocket Body */}
          <rect
            x="285"
            y="270"
            width="30"
            height="80"
            fill="url(#rocketBodyGradient)"
            rx="5"
            ry="5"
          />
          {/* Rocket Top (Cone) */}
          <polygon points="285,270 315,270 300,240" fill="#CD5C5C" />{" "}
          {/* Indian Red */}
          {/* Rocket Fins */}
          <polygon points="285,320 275,340 285,350" fill="#CD5C5C" />
          <polygon points="315,320 325,340 315,350" fill="#CD5C5C" />
          {/* Rocket Flame */}
          <path
            d="M290,350 Q295,360 300,370 Q305,360 310,350 Z"
            fill="url(#flameGradient)"
          >
            <animate
              attributeName="d"
              values="M290,350 Q295,360 300,370 Q305,360 310,350 Z;
                                             M290,350 Q295,365 300,375 Q305,365 310,350 Z;
                                             M290,350 Q295,360 300,370 Q305,360 310,350 Z"
              dur="0.3s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        {/* Projectile - appears and flies after rocket launch */}
        <g className="projectile" transform="translate(300, 200)">
          <circle cx="0" cy="0" r="5" fill="#FFD700" /> {/* Gold color */}
          {/* Simple trail for projectile */}
          <path
            d="M-5,0 L-10,-2 L-15,-5 L-10,2 Z"
            fill="#FFA500"
            opacity="0.7"
          />
        </g>
      </svg>
    </main>
  );
}
