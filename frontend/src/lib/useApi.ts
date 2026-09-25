import { useEffect, useRef, useState } from 'react'
import { api, type ExperimentDetailResponse } from '../api/client'

// One in-flight/settled request per key, shared by every component that asks
// for it (top bar, overview, analysis pages all read /experiments, etc.).
// Failed requests are evicted so a later mount retries.
const cache = new Map<string, Promise<unknown>>()

export function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  let promise = cache.get(key) as Promise<T> | undefined
  if (!promise) {
    promise = fetcher()
    cache.set(key, promise)
    promise.catch(() => cache.delete(key))
  }
  return promise
}

export interface ApiState<T> {
  data: T | null
  error: boolean
  loading: boolean
}

export function useApi<T>(key: string | null, fetcher: () => Promise<T>): ApiState<T> {
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })
  const [state, setState] = useState<{ key: string | null; data: T | null; error: boolean }>({
    key: null,
    data: null,
    error: false,
  })

  useEffect(() => {
    if (key === null) return
    let live = true
    cachedFetch(key, () => fetcherRef.current()).then(
      (data) => live && setState({ key, data, error: false }),
      () => live && setState({ key, data: null, error: true }),
    )
    return () => {
      live = false
    }
  }, [key])

  if (key === null) return { data: null, error: false, loading: false }
  if (state.key !== key) return { data: null, error: false, loading: true }
  return { data: state.data, error: state.error, loading: false }
}

export function useExperimentDetail(experiment: string | null, model: string | null) {
  const key = experiment && model ? `detail:${experiment}:${model}` : null
  return useApi<ExperimentDetailResponse>(key, () => api.experimentDetail(experiment ?? '', model ?? ''))
}

/** Detail bundles for several models of one experiment (comparison views). */
export function useExperimentDetails(experiment: string | null, models: string[]) {
  const key = experiment && models.length ? `details:${experiment}:${models.join(',')}` : null
  return useApi<Record<string, ExperimentDetailResponse>>(key, async () => {
    const entries = await Promise.all(
      models.map(
        async (m) =>
          [m, await cachedFetch(`detail:${experiment}:${m}`, () => api.experimentDetail(experiment ?? '', m))] as const,
      ),
    )
    return Object.fromEntries(entries)
  })
}

export const useHealth = () => useApi('health', api.health)
export const useDataSource = () => useApi('data-source', api.dataSource)
export const useStatistics = () => useApi('statistics', api.statistics)
export const useExperiments = () => useApi('experiments', api.experiments)
export const useReproducibility = () => useApi('reproducibility', api.reproducibility)
export const useFeatureAudit = () => useApi('feature-audit', api.featureAudit)
export const useFeatures = () => useApi('features', api.features)
export const useLimitations = () => useApi('limitations', api.limitations)
