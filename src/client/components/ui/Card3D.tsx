import React, { useRef, useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface Card3DProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  depth?: number;
  glareOpacity?: number;
  glare?: boolean;
}

export function Card3D({
  children,
  className,
  maxTilt = 7,
  depth,
  glareOpacity = 0.15,
  glare = true,
  onMouseMove,
  onMouseEnter,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  style,
  ...props
}: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [tilt, setTilt] = useState({ rotX: 0, rotY: 0, scale: 1 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Clean up any pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Listen for reduced motion changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);
      const listener = () => setReducedMotion(media.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  const effectiveTilt = depth ? Math.min(12, Math.max(4, Math.round(depth / 2.5))) : maxTilt;
  const perspective = depth ? Math.max(600, depth * 45) : 1000;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseMove?.(e);
      if (reducedMotion || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const xPct = Math.max(0, Math.min(1, clientX / rect.width));
      const yPct = Math.max(0, Math.min(1, clientY / rect.height));

      // Calculate tilt angles: mouse top tilts card backward (-X), mouse right tilts card right (+Y)
      const rotX = (0.5 - yPct) * (effectiveTilt * 2);
      const rotY = (xPct - 0.5) * (effectiveTilt * 2);

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        setTilt({ rotX, rotY, scale: 1.02 });
        setGlarePos({
          x: xPct * 100,
          y: yPct * 100,
          opacity: glareOpacity,
        });
      });
    },
    [effectiveTilt, glareOpacity, reducedMotion, onMouseMove]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseEnter?.(e);
      if (!reducedMotion) {
        setIsHovered(true);
      }
    },
    [reducedMotion, onMouseEnter]
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(e);
      if (reducedMotion) return;
      setIsHovered(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        setTilt({ rotX: 0, rotY: 0, scale: 1 });
        setGlarePos((prev) => ({ ...prev, opacity: 0 }));
      });
    },
    [reducedMotion, onMouseLeave]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      onTouchStart?.(e);
    },
    [onTouchStart]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      onTouchEnd?.(e);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setTilt({ rotX: 0, rotY: 0, scale: 1 });
      setGlarePos((prev) => ({ ...prev, opacity: 0 }));
      setIsHovered(false);
    },
    [onTouchEnd]
  );

  const transformStyle =
    !reducedMotion && isHovered
      ? `perspective(${perspective}px) rotateX(${tilt.rotX.toFixed(2)}deg) rotateY(${tilt.rotY.toFixed(2)}deg) scale3d(${tilt.scale}, ${tilt.scale}, 1)`
      : undefined;

  const transitionStyle = isHovered
    ? 'transform 0.08s ease-out'
    : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        transformStyle: 'preserve-3d',
        transition: transitionStyle,
        transform: transformStyle,
        ...style,
      }}
      className={twMerge(
        clsx(
          'relative preserve-3d will-change-transform rounded-2xl',
          className
        )
      )}
      {...props}
    >
      {/* Specular 3D Holographic Glare */}
      {!reducedMotion && glare && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none rounded-[inherit] z-30 transition-opacity duration-300 overflow-hidden"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle 320px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.04) 50%, transparent 80%)`,
          }}
        />
      )}

      {/* Card Content with 3D child preservation */}
      <div className="relative z-10 preserve-3d h-full flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
}
