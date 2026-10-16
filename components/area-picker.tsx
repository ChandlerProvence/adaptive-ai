"use client"

import * as React from "react"
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"
import type { TerraDraw } from "terra-draw"
import { combineAreas, DRAWN_AREA_LABEL, isAreaGeometry, type AreaGeometry } from "@/lib/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import "maplibre-gl/dist/maplibre-gl.css"

const AOI = "#2563eb" as const
const AOR = "#c2410c" as const
const BASEMAP = "https://tiles.openfreemap.org/styles/liberty"

export type AreaField = "interest" | "responsibility"

export interface AreaDraft {
  label: string
  geometry?: AreaGeometry
  countries: string[]
}

export const EMPTY_AREA: AreaDraft = { label: "", countries: [] }

interface CountryFeature {
  properties: { name: string }
  geometry: AreaGeometry
}

let countriesRequest: Promise<CountryFeature[]> | null = null

function loadCountries(): Promise<CountryFeature[]> {
  countriesRequest ??= fetch("/geo/countries.json")
    .then((response) => {
      if (!response.ok) throw new Error("Country outlines did not load.")
      return response.json() as Promise<{ features?: { properties?: { name?: string }; geometry?: unknown }[] }>
    })
    .then((data) =>
      (data.features ?? [])
        .filter((feature): feature is { properties: { name: string }; geometry: AreaGeometry } => {
          return typeof feature.properties?.name === "string" && isAreaGeometry(feature.geometry)
        })
        .map((feature) => ({ properties: { name: feature.properties.name }, geometry: feature.geometry })),
    )
  return countriesRequest
}

function polygonStyles(color: `#${string}`) {
  return {
    fillColor: color,
    fillOpacity: 0.28,
    outlineColor: color,
    outlineOpacity: 1,
    outlineWidth: 2,
  }
}

function collection(interest: AreaDraft, responsibility: AreaDraft, drawing: boolean, active: AreaField) {
  const features = []
  if (interest.geometry && !(drawing && active === "interest")) {
    features.push({ type: "Feature" as const, properties: { kind: "interest" }, geometry: interest.geometry })
  }
  if (responsibility.geometry && !(drawing && active === "responsibility")) {
    features.push({ type: "Feature" as const, properties: { kind: "responsibility" }, geometry: responsibility.geometry })
  }
  return { type: "FeatureCollection" as const, features }
}

function extendBounds(bounds: { extend: (coord: [number, number]) => void }, geometry: AreaGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const position of ring) {
        if (position.length >= 2) bounds.extend([position[0], position[1]])
      }
    }
  }
}

export function AreaPicker({
  open,
  active,
  onActiveChange,
  interest,
  responsibility,
  onChange,
}: {
  open: boolean
  active: AreaField
  onActiveChange: (field: AreaField) => void
  interest: AreaDraft
  responsibility: AreaDraft
  onChange: (field: AreaField, value: AreaDraft) => void
}) {
  const container = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<MapLibreMap | null>(null)
  const drawRef = React.useRef<TerraDraw | null>(null)
  const boundsRef = React.useRef<typeof import("maplibre-gl").LngLatBounds | null>(null)
  const activeRef = React.useRef(active)
  const onChangeRef = React.useRef(onChange)
  const areasRef = React.useRef({ interest, responsibility, drawing: false, active })
  const [countries, setCountries] = React.useState<CountryFeature[]>([])
  const [query, setQuery] = React.useState("")
  const [drawing, setDrawing] = React.useState(false)
  const [mapReady, setMapReady] = React.useState(false)
  const [mapNote, setMapNote] = React.useState("")

  activeRef.current = active
  onChangeRef.current = onChange
  areasRef.current = { interest, responsibility, drawing, active }

  React.useEffect(() => {
    let cancelled = false
    loadCountries()
      .then((features) => {
        if (!cancelled) setCountries(features)
      })
      .catch(() => {
        if (!cancelled) setMapNote("Country outlines did not load.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (!open || !container.current) return
    let cancelled = false
    let map: MapLibreMap | undefined
    let draw: TerraDraw | undefined
    const node = container.current

    ;(async () => {
      const maplibregl = await import("maplibre-gl")
      const { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } = await import("terra-draw")
      const { TerraDrawMapLibreGLAdapter } = await import("terra-draw-maplibre-gl-adapter")
      if (cancelled) return
      // The bundler worker URL does not load. This file is maplibre-gl's worker, served as-is.
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs")
      boundsRef.current = maplibregl.LngLatBounds
      const created = new maplibregl.Map({
        container: node,
        style: BASEMAP,
        center: [12, 20],
        zoom: 1.15,
      })
      map = created
      mapRef.current = created
      created.on("load", () => {
        if (cancelled) return
        created.addSource("areas", { type: "geojson", data: collection(areasRef.current.interest, areasRef.current.responsibility, false, areasRef.current.active) })
        created.addLayer({
          id: "areas-fill",
          type: "fill",
          source: "areas",
          paint: {
            "fill-color": ["match", ["get", "kind"], "responsibility", AOR, AOI],
            "fill-opacity": 0.28,
          },
        })
        created.addLayer({
          id: "areas-line",
          type: "line",
          source: "areas",
          paint: {
            "line-color": ["match", ["get", "kind"], "responsibility", AOR, AOI],
            "line-width": 2,
          },
        })
        const instance = new TerraDraw({
          adapter: new TerraDrawMapLibreGLAdapter({ map: created }),
          modes: [
            new TerraDrawSelectMode(),
            new TerraDrawPolygonMode({ modeName: "polygon", styles: polygonStyles(AOI) }),
          ],
        })
        draw = instance
        instance.start()
        instance.setMode("select")
        instance.on("finish", (id) => {
          const feature = instance.getSnapshot().find((item) => item.id === id)
          const geometry = feature?.geometry
          if (!isAreaGeometry(geometry)) return
          const stored = JSON.parse(JSON.stringify(geometry)) as AreaGeometry
          instance.clear()
          instance.setMode("select")
          setDrawing(false)
          onChangeRef.current(activeRef.current, { label: DRAWN_AREA_LABEL, geometry: stored, countries: [] })
        })
        drawRef.current = instance
        setMapReady(true)
        created.resize()
        requestAnimationFrame(() => created.resize())
      })
      created.on("error", () => {
        setMapNote("The basemap did not load. Country names still save with the effort.")
      })
    })().catch(() => {
      if (!cancelled) setMapNote("The map could not start. Country names still save with the effort.")
    })

    const observer = new ResizeObserver(() => mapRef.current?.resize())
    observer.observe(node)
    return () => {
      cancelled = true
      observer.disconnect()
      draw?.stop()
      map?.remove()
      mapRef.current = null
      drawRef.current = null
      setMapReady(false)
      setDrawing(false)
    }
  }, [open])

  React.useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const source = map.getSource("areas") as GeoJSONSource | undefined
    source?.setData(collection(interest, responsibility, drawing, active))
  }, [active, drawing, interest, mapReady, responsibility])

  React.useEffect(() => {
    if (!mapReady) return
    drawRef.current?.updateModeOptions("polygon", { styles: polygonStyles(active === "interest" ? AOI : AOR) })
  }, [active, mapReady])

  React.useEffect(() => {
    const map = mapRef.current
    const Bounds = boundsRef.current
    if (!mapReady || drawing || !map || !Bounds) return
    const bounds = new Bounds()
    if (interest.geometry) extendBounds(bounds, interest.geometry)
    if (responsibility.geometry) extendBounds(bounds, responsibility.geometry)
    if (bounds.isEmpty()) return
    map.fitBounds(bounds, { padding: 48, maxZoom: 4, duration: 400 })
  }, [drawing, interest.geometry, mapReady, responsibility.geometry])

  function commitCountries(field: AreaField, names: string[]) {
    const geometries = names.flatMap((name) => {
      const geometry = countries.find((country) => country.properties.name === name)?.geometry
      return geometry ? [geometry] : []
    })
    onChange(field, { label: names.join(", "), geometry: combineAreas(geometries), countries: names })
  }

  function stopDrawing() {
    drawRef.current?.clear()
    drawRef.current?.setMode("select")
    setDrawing(false)
  }

  function chooseCountry(name: string) {
    stopDrawing()
    const current = active === "interest" ? interest : responsibility
    if (current.label === DRAWN_AREA_LABEL) {
      commitCountries(active, [name])
      return
    }
    const names = current.countries.includes(name) ? current.countries : [...current.countries, name]
    commitCountries(active, names)
  }

  function removeCountry(name: string) {
    const current = active === "interest" ? interest : responsibility
    commitCountries(active, current.countries.filter((item) => item !== name))
  }

  function clearActive() {
    stopDrawing()
    onChange(active, EMPTY_AREA)
  }

  function startDrawing() {
    if (!drawRef.current) return
    drawRef.current.clear()
    drawRef.current.setMode("polygon")
    setDrawing(true)
  }

  const current = active === "interest" ? interest : responsibility
  const matches = query.trim()
    ? countries
        .filter((country) => country.properties.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
        .map((country) => country.properties.name)
    : []

  return (
    <div data-area-picker className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            data-area-field="interest"
            onClick={() => onActiveChange("interest")}
            className={cn("rounded-md px-3 py-2 text-left text-xs font-medium", active === "interest" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: AOI }} />
              Area of interest
            </span>
            <span className="mt-0.5 block truncate font-normal text-muted-foreground">{interest.label || "Not set"}</span>
          </button>
          <button
            type="button"
            data-area-field="responsibility"
            onClick={() => onActiveChange("responsibility")}
            className={cn("rounded-md px-3 py-2 text-left text-xs font-medium", active === "responsibility" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: AOR }} />
              Area of responsibility
            </span>
            <span className="mt-0.5 block truncate font-normal text-muted-foreground">{responsibility.label || "Not set"}</span>
          </button>
        </div>
        <div className="relative">
          <Input
            value={query}
            placeholder={countries.length ? "Search countries" : "Loading countries"}
            disabled={!countries.length}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              if (matches[0]) chooseCountry(matches[0])
              setQuery("")
            }}
          />
          {matches.length ? (
            <ul className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
              {matches.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    data-country={name}
                    className="flex w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      chooseCountry(name)
                      setQuery("")
                    }}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {current.countries.length ? (
          <div className="flex flex-wrap gap-1.5">
            {current.countries.map((name) => (
              <button
                key={name}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs"
                onClick={() => removeCountry(name)}
              >
                {name}
                <X className="size-3" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {drawing ? (
            <Button type="button" size="sm" variant="outline" onClick={stopDrawing}>
              Cancel drawing
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={!mapReady} onClick={startDrawing}>
              Draw polygon
            </Button>
          )}
          {current.label ? (
            <Button type="button" size="sm" variant="ghost" onClick={clearActive}>
              Clear
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {drawing ? "Click to add points. Click the first point to close the area." : "Countries and a drawing replace each other for the selected area."}
          </p>
        </div>
      </div>
      <div className="relative min-h-72 flex-1">
        <div ref={container} className="h-full min-h-72 w-full" />
        {mapNote ? <p className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground">{mapNote}</p> : null}
      </div>
    </div>
  )
}
