export const CANVAS_WIDTH = 320;
export const CANVAS_HEIGHT = 200;

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function computeTransform(
  containerWidth: number,
  containerHeight: number
): CanvasTransform {
  const scaleX = containerWidth / CANVAS_WIDTH;
  const scaleY = containerHeight / CANVAS_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  return {
    scale,
    offsetX: (containerWidth - CANVAS_WIDTH * scale) / 2,
    offsetY: (containerHeight - CANVAS_HEIGHT * scale) / 2,
  };
}

/** Canvas pixel → DOM pixel (for positioning overlays) */
export function canvasToDOM(
  t: CanvasTransform,
  cx: number,
  cy: number
): { x: number; y: number } {
  return {
    x: cx * t.scale + t.offsetX,
    y: cy * t.scale + t.offsetY,
  };
}

/** DOM pixel → Canvas pixel (for mouse events) */
export function domToCanvas(
  t: CanvasTransform,
  dx: number,
  dy: number
): { x: number; y: number } {
  return {
    x: (dx - t.offsetX) / t.scale,
    y: (dy - t.offsetY) / t.scale,
  };
}
