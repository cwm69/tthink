'use client';

import { Controls as FlowControls, useReactFlow } from '@xyflow/react';
import { memo, useEffect, useState } from 'react';

export const ControlsInner = () => {
  const { getViewport } = useReactFlow();
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const updateZoom = () => {
      const { zoom: currentZoom } = getViewport();
      // Map zoom range (0.15 to 8) to percentage (15% to 800%)
      const percentage = Math.round(currentZoom * 100);
      setZoom(Math.max(15, Math.min(800, percentage)));
    };

    // Update zoom on mount
    updateZoom();

    // Update zoom on viewport changes (throttled)
    let timeoutId: NodeJS.Timeout;
    const handleViewportChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateZoom, 50);
    };

    // Listen for viewport changes
    const interval = setInterval(updateZoom, 100);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [getViewport]);

  return (
    <FlowControls
      orientation="horizontal"
      className="flex-col! rounded-full border bg-card/90 p-1 shadow-none! drop-shadow-xs backdrop-blur-sm sm:flex-row!"
      showInteractive={false}
    >
      <div className="flex items-center px-2 text-xs font-medium text-muted-foreground">
        {zoom}%
      </div>
    </FlowControls>
  );
};

export const Controls = memo(ControlsInner);
