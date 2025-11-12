// Implementação do GeometryUtils
const GeometryUtilsImpl = {
  clamp(v: number, a: number, b: number): number {
    return Math.max(a, Math.min(b, v));
  },

  distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x1 - x2, y1 - y2);
  },

  pointInRect(x: number, y: number, rect: Rect): boolean {
    return (
      x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
    );
  },

  rectCircleOverlap(rect: Rect, circle: Circle): boolean {
    const x = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const y = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    return (
      (x - circle.x) * (x - circle.x) + (y - circle.y) * (y - circle.y) <=
      circle.r * circle.r
    );
  },

  rayCircleIntersectT(
    rx: number,
    ry: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    cr: number
  ): number | null {
    const ox = rx - cx,
      oy = ry - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (ox * dx + oy * dy);
    const c = ox * ox + oy * oy - cr * cr;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const s = Math.sqrt(disc);
    const t1 = (-b - s) / (2 * a),
      t2 = (-b + s) / (2 * a);
    if (t1 >= 0) return t1;
    if (t2 >= 0) return t2;
    return null;
  },

  normalizeAngle(angle: number): number {
    // Normaliza o ângulo para o intervalo [-PI, PI]
    const TWO_PI = Math.PI * 2;
    let normalized = angle % TWO_PI;
    if (normalized > Math.PI) {
      normalized -= TWO_PI;
    } else if (normalized < -Math.PI) {
      normalized += TWO_PI;
    }
    return normalized;
  },
};

// Exporta para uso global
if (typeof window !== "undefined") {
  (window as unknown as WindowType).GeometryUtils = GeometryUtilsImpl;
}
