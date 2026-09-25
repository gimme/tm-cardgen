// Non-reactive singletons, created during app init.
import type { FontService, LayoutContext } from '../../core/index.ts'
import { ArtCache } from '../services/artCache.ts'
import type { ProjectStore } from '../storage/ProjectStore.ts'

export interface Services {
  fonts: FontService
  art: ArtCache
  store: ProjectStore
}

let services: Services | undefined

export function setServices(s: Services): void {
  services = s
}

export function getServices(): Services {
  if (!services) throw new Error('services not initialized')
  return services
}

/** The LayoutContext both preview and export lay out through. */
export function layoutContext(): LayoutContext {
  const { fonts, art } = getServices()
  return {
    measurer: fonts,
    artSize: (file) => art.size(file),
    artBrightness: (file, region) => art.brightness(file, region),
  }
}
