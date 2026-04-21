const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

export function enterExtrusion3D(map) {
  map.easeTo({ pitch: 50, bearing: -15, duration: 1200, easing: ease })
}

export function exitExtrusion3D(map) {
  map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
}
