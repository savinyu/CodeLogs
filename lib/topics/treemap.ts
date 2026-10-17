// Squarified treemap layout (Bruls, Huizing, van Wijk), ported from the Coach 2 mockup. Pure.

export interface TreemapRect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Share of the positive total that a tile with no value (zero, negative or NaN) gets. */
const MIN_SHARE = 0.02;

const isPositive = (v: number) => v > 0 && Number.isFinite(v);

/**
 * Lays `items` out in a width x height box so each rectangle's area is proportional to its value.
 * Items with a value of 0 or less (or not finite) get a small minimum, MIN_SHARE of the positive
 * total (1 when nothing is positive), so every topic still has a tile to click. Larger values
 * come first; ties keep the input order, so the result is deterministic.
 */
export function squarify<T>(
  items: { item: T; value: number }[],
  width: number,
  height: number,
): TreemapRect<T>[] {
  if (items.length === 0 || width <= 0 || height <= 0) return [];
  const positive = items.reduce((n, i) => (isPositive(i.value) ? n + i.value : n), 0);
  const floor = positive > 0 ? positive * MIN_SHARE : 1;
  const values = items.map((i) => (isPositive(i.value) ? i.value : floor));
  const total = values.reduce((a, b) => a + b, 0);
  const k = (width * height) / total;
  const nodes = items
    .map((entry, index) => ({ item: entry.item, area: values[index]! * k, index }))
    .sort((a, b) => b.area - a.area || a.index - b.index);

  const out: TreemapRect<T>[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let row: typeof nodes = [];
  const sum = (r: typeof nodes) => r.reduce((a, n) => a + n.area, 0);
  const worst = (r: typeof nodes, side: number) => {
    const s = sum(r);
    const mx = Math.max(...r.map((n) => n.area));
    const mn = Math.min(...r.map((n) => n.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const place = (r: typeof nodes) => {
    const s = sum(r);
    if (w >= h) {
      const cw = s / h;
      let yy = y;
      for (const n of r) {
        const nh = n.area / cw;
        out.push({ item: n.item, x, y: yy, w: cw, h: nh });
        yy += nh;
      }
      x += cw;
      w -= cw;
    } else {
      const rh = s / w;
      let xx = x;
      for (const n of r) {
        const nw = n.area / rh;
        out.push({ item: n.item, x: xx, y, w: nw, h: rh });
        xx += nw;
      }
      y += rh;
      h -= rh;
    }
  };
  for (const n of nodes) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else {
      place(row);
      row = [n];
    }
  }
  if (row.length) place(row);
  return out;
}
