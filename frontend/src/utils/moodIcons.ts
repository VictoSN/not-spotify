import {
  BoltIcon,
  BriefcaseIcon,
  CloudIcon,
  FireIcon,
  HeartIcon,
  HomeIcon,
  MoonIcon,
  MusicalNoteIcon,
  SparklesIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

// Heroicon names the backend stores on a mood tag → the component to render.
const registry: Record<string, IconComponent> = {
  BriefcaseIcon,
  BoltIcon,
  SparklesIcon,
  MoonIcon,
  SunIcon,
  HomeIcon,
  CloudIcon,
  HeartIcon,
  FireIcon,
}

/** Resolve a mood tag's icon name to a component, defaulting to a music note. */
export function moodIcon(name: string | null | undefined): IconComponent {
  return (name && registry[name]) || MusicalNoteIcon
}
