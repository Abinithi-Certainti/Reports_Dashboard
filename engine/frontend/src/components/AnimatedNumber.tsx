import { useEffect, useRef, useState } from 'react';
import { formatValue } from '../format';

/** Counts smoothly from the previous value to the new one (ease-out, ~700 ms). */
export default function AnimatedNumber({ value, format }: { value: number; format: string | null | undefined }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (b - a) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{formatValue(shown, format)}</>;
}
