import { NodeToolbar as NodeToolbarRaw, useReactFlow } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { Fragment, type ReactNode, useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type NodeToolbarProps = {
  id: string;
  items:
    | {
        tooltip?: string;
        children: ReactNode;
      }[]
    | undefined;
};

export const NodeToolbar = ({ id, items }: NodeToolbarProps) => {
  const { getNode, updateNode } = useReactFlow();
  const node = getNode(id);
  const [isHovered, setIsHovered] = useState(false);

  // Keep node selected while toolbar is hovered
  useEffect(() => {
    if (isHovered && node && !node.selected) {
      updateNode(id, { selected: true });
    }
  }, [isHovered, node, id, updateNode]);

  return (
    <NodeToolbarRaw
      isVisible={node?.selected || isHovered}
      position={Position.Bottom}
      className="flex items-center gap-1 rounded-full bg-background/40 p-1.5 backdrop-blur-sm"
      onMouseEnter={() => {
        setIsHovered(true);
        // Keep node selected while toolbar is hovered
        if (node && !node.selected) {
          updateNode(id, { selected: true });
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
      data-node-toolbar="true"
    >
      {items?.map((button, index) =>
        button.tooltip ? (
          <Tooltip key={button.tooltip}>
            <TooltipTrigger asChild>{button.children}</TooltipTrigger>
            <TooltipContent>{button.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          <Fragment key={index}>{button.children}</Fragment>
        )
      )}
    </NodeToolbarRaw>
  );
};
