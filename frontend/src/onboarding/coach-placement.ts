interface Rect { left: number; right: number; top: number; bottom: number; }
interface Size { width: number; height: number; }

/** Find room for the whole coach and Stocky without covering its target. */
export function positionCoach(target: Rect, card: Size, viewport: Size): { left: number; top: number } | null {
  const edge = 16, mascot = 46, gap = 22;
  const minTop = edge + mascot, maxTop = viewport.height - edge - card.height;
  const maxLeft = viewport.width - edge - card.width;
  if (maxTop < minTop || maxLeft < edge) return null;
  const besideTop = Math.max(minTop, Math.min(target.top, maxTop));
  const centeredLeft = Math.max(edge, Math.min((target.left + target.right - card.width) / 2, maxLeft));
  const candidates = [
    { left: target.right + gap, top: besideTop },
    { left: target.left - card.width - gap, top: besideTop },
    { left: centeredLeft, top: Math.max(minTop, target.bottom + gap + mascot) },
    { left: centeredLeft, top: Math.min(maxTop, target.top - card.height - gap) },
  ];
  return candidates.find(({ left, top }) => left >= edge && left <= maxLeft && top >= minTop && top <= maxTop) ?? null;
}
