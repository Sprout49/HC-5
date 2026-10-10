import React from 'react';

interface TranetraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const TranetraLogo: React.FC<TranetraLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const textSizes = {
    sm: 'text-sm font-extrabold tracking-widest',
    md: 'text-xl font-black tracking-widest',
    lg: 'text-3xl font-black tracking-widest',
    xl: 'text-4xl font-black tracking-widest',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* SVG Icon matching TRÃNETRA logo */}
      <div className={`relative ${iconSizes[size]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-lg"
        >
          <defs>
            <linearGradient id="logoBlueGrad" x1="100" y1="50" x2="400" y2="400" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>

            <linearGradient id="cyanAccent" x1="0" y1="0" x2="500" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="40%" stopColor="#3b82f6" />
              <stop offset="80%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>

            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Left Wing/Hand forming Heart */}
          <path
            d="M 250 310
               C 210 270, 120 200, 125 120
               C 128 75, 175 50, 230 90
               C 245 102, 250 120, 250 145
               C 230 135, 185 150, 180 195
               C 175 235, 220 275, 250 310 Z"
            fill="url(#logoBlueGrad)"
          />

          {/* Right Wing/Hand forming Heart */}
          <path
            d="M 250 310
               C 290 270, 380 200, 375 120
               C 372 75, 325 50, 270 90
               C 255 102, 250 120, 250 145
               C 270 135, 315 150, 320 195
               C 325 235, 280 275, 250 310 Z"
            fill="url(#logoBlueGrad)"
          />

          {/* Outer Left Hand Sweep */}
          <path
            d="M 125 120
               C 115 170, 140 230, 200 285
               C 225 308, 248 318, 250 319
               C 250 319, 246 305, 240 290
               C 200 270, 160 220, 162 180
               C 164 140, 205 115, 230 130
               C 210 80, 160 65, 125 120 Z"
            fill="#38bdf8"
            opacity="0.9"
          />

          {/* Outer Right Hand Sweep */}
          <path
            d="M 375 120
               C 385 170, 360 230, 300 285
               C 275 308, 252 318, 250 319
               C 250 319, 254 305, 260 290
               C 300 270, 340 220, 338 180
               C 336 140, 295 115, 270 130
               C 290 80, 340 65, 375 120 Z"
            fill="#38bdf8"
            opacity="0.9"
          />

          {/* Center Cross with Leaf Sprout */}
          <g transform="translate(210, 185)">
            {/* Cross Vertical */}
            <path
              d="M 34 20 H 46 V 95 H 34 Z"
              fill="#2563eb"
              rx="3"
            />
            {/* Cross Horizontal */}
            <path
              d="M 18 40 H 62 V 52 H 18 Z"
              fill="#2563eb"
              rx="3"
            />
            {/* Sprout Leaf attached to cross */}
            <path
              d="M 22 38 C 10 32, 5 15, 18 12 C 26 20, 23 32, 22 38 Z"
              fill="#38bdf8"
            />
          </g>

          {/* Heart Base Join */}
          <path
            d="M 240 305 C 248 322, 252 322, 260 305 C 255 315, 245 315, 240 305 Z"
            fill="#1d4ed8"
          />
        </svg>
      </div>

      {/* Brand Name Typography */}
      {showText && (
        <div className="flex flex-col items-center mt-3 text-center">
          <span
            className={`${textSizes[size]} uppercase tracking-[0.3em] font-sans font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 drop-shadow-xs`}
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
            TRÃNETRA
          </span>
        </div>
      )}
    </div>
  );
};
