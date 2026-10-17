import { useSyncExternalStore } from 'react'

// A very small history router. Routes: "/", "/under", "/top", "/play", "/text". "/blue" and "/red" redirect.
// A galaxy can be opened at one stop with ?stop=<id> (see src/scenes/Explore.jsx).
const listeners = new Set()

function emit() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', emit)
}

export function navigate(path, { replace = false } = {}) {
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  emit()
}

function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getPath() {
  return window.location.pathname
}

export function usePath() {
  return useSyncExternalStore(subscribe, getPath, () => '/')
}

export function searchParam(name) {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(name)
}

// Drop one query parameter without a new history entry. Other parameters (?fx, ?intro) stay, and
// nothing re-renders because the path hasn't changed.
export function dropSearchParam(name) {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(name)) return
  url.searchParams.delete(name)
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}
