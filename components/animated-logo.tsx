'use client';

import { useState } from 'react';

export const AnimatedLogo = () => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="select-none cursor-default font-bold text-sm tracking-tight text-foreground/90 hover:text-foreground transition-colors duration-200"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        letterSpacing: '-0.02em'
      }}
    >
      <span className="inline-block">t</span>
      <span
        className={`inline-block overflow-hidden transition-all duration-[180ms] ease-out ${
          isHovered 
            ? 'max-w-[2.5rem] opacity-100 transform translate-x-0' 
            : 'max-w-0 opacity-0 transform -translate-x-2'
        }`}
      >
        <span className="whitespace-nowrap text-primary font-semibold">uring</span>
      </span>
      <span className="inline-block">think</span>
    </div>
  );
};