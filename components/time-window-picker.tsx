"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const PRESETS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
] as const

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  const next = startOfDay(date)
  next.setDate(next.getDate() + days)
  return next
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/** Inclusive range ending today. Last 7 days is today and the six days before it. */
export function presetRange(days: number, today = new Date()) {
  const end = startOfDay(today)
  return { start: addDays(end, -(days - 1)), end }
}

export function formatTimeWindow(start: Date, end: Date) {
  const [from, to] = start.getTime() <= end.getTime() ? [start, end] : [end, start]
  if (sameDay(from, to)) return dayLabel(from)
  return `${dayLabel(from)} – ${dayLabel(to)}`
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const count = new Date(year, month + 1, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let index = 0; index < first.getDay(); index += 1) {
    const date = new Date(year, month, index - first.getDay() + 1)
    cells.push({ date, inMonth: false })
  }
  for (let day = 1; day <= count; day += 1) cells.push({ date: new Date(year, month, day), inMonth: true })
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month, count + (cells.length - (first.getDay() + count) + 1))
    cells.push({ date, inMonth: false })
  }
  return cells
}

export function TimeWindowPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const today = startOfDay(new Date())
  const [visible, setVisible] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [start, setStart] = React.useState<Date | null>(null)
  const [end, setEnd] = React.useState<Date | null>(null)
  const [hover, setHover] = React.useState<Date | null>(null)

  function commit(nextStart: Date, nextEnd: Date | null) {
    setStart(nextStart)
    setEnd(nextEnd)
    onChange(nextEnd ? formatTimeWindow(nextStart, nextEnd) : "")
  }

  function selectPreset(days: number) {
    const range = presetRange(days, today)
    commit(range.start, range.end)
    setVisible(new Date(range.end.getFullYear(), range.end.getMonth(), 1))
    setHover(null)
  }

  function selectDay(date: Date) {
    const day = startOfDay(date)
    if (!start || end) {
      commit(day, null)
      return
    }
    commit(start, day)
    setHover(null)
  }

  const previewEnd = !end && start && hover ? hover : end
  const cells = monthCells(visible.getFullYear(), visible.getMonth())
  const activePreset = PRESETS.find((preset) => {
    if (!start || !end) return false
    const range = presetRange(preset.days, today)
    return sameDay(start, range.start) && sameDay(end, range.end)
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.days}
            type="button"
            size="sm"
            variant={activePreset?.days === preset.days ? "default" : "outline"}
            onClick={() => selectPreset(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setVisible(new Date(visible.getFullYear(), visible.getMonth() - 1, 1))}>
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium">
          {visible.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setVisible(new Date(visible.getFullYear(), visible.getMonth() + 1, 1))}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {day}
          </span>
        ))}
        {cells.map(({ date, inMonth }) => {
          const from = start && previewEnd ? (start.getTime() <= previewEnd.getTime() ? start : previewEnd) : start
          const to = start && previewEnd ? (start.getTime() <= previewEnd.getTime() ? previewEnd : start) : null
          const isStart = !!from && sameDay(date, from)
          const isEnd = !!to && sameDay(date, to)
          const inside = !!from && !!to && date.getTime() > from.getTime() && date.getTime() < to.getTime()
          const preview = !end && inside
          return (
            <button
              key={date.toISOString()}
              type="button"
              aria-label={dayLabel(date)}
              data-range={isStart ? "start" : isEnd ? "end" : inside ? "between" : undefined}
              onMouseEnter={() => setHover(startOfDay(date))}
              onMouseLeave={() => setHover(null)}
              onClick={() => selectDay(date)}
              className={cn(
                "flex h-9 items-center justify-center text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                (inside || isStart || isEnd) && "bg-primary/15",
                preview && "bg-primary/10",
                isStart && "rounded-l-md",
                isEnd && "rounded-r-md",
                isStart && isEnd && "rounded-md",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-md",
                  (isStart || isEnd) && "bg-primary font-medium text-primary-foreground",
                  sameDay(date, today) && !isStart && !isEnd && "ring-1 ring-inset ring-primary/50",
                )}
              >
                {date.getDate()}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value || (start ? "Select an end date" : "Select a start date, then an end date")}
      </p>
    </div>
  )
}
