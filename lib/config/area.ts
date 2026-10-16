import type { AreaGeometry } from "./types.ts"

export const DRAWN_AREA_LABEL = "Drawn area"

export function isAreaGeometry(value: unknown): value is AreaGeometry {
  if (!value || typeof value !== "object") return false
  const geometry = value as { type?: unknown; coordinates?: unknown }
  return (geometry.type === "Polygon" || geometry.type === "MultiPolygon") && Array.isArray(geometry.coordinates)
}

/** One outline per area. Several countries become a single multipolygon. */
export function combineAreas(geometries: AreaGeometry[]): AreaGeometry | undefined {
  const polygons: number[][][][] = []
  for (const geometry of geometries) {
    if (geometry.type === "Polygon") polygons.push(geometry.coordinates)
    else polygons.push(...geometry.coordinates)
  }
  if (polygons.length === 0) return undefined
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] }
  return { type: "MultiPolygon", coordinates: polygons }
}
