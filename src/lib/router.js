import { useSyncExternalStore } from 'react'

// A very small history router. Routes: "/", "/under", "/top", "/text". "/blue" and "/red" redirect.
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
