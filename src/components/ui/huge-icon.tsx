import * as React from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { cn } from '@/lib/utils';

interface HugeIconProps extends React.ComponentPropsWithoutRef<typeof HugeiconsIcon> {
  icon: IconSvgElement;
}

const HugeIcon = React.forwardRef<SVGSVGElement, HugeIconProps>(
  ({ className, color = 'currentColor', strokeWidth = 1.8, ...props }, ref) => (
    <HugeiconsIcon
      ref={ref}
      color={color}
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      {...props}
    />
  )
);

HugeIcon.displayName = 'HugeIcon';

export { HugeIcon };
