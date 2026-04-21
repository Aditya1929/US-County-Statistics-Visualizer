import './crt.css'
import { useApp } from '../../context/AppContext.jsx'

export default function CRTOverlay() {
  const { state } = useApp()
  if (!state.crtMode) return null
  return (
    <>
      <div className="crt-overlay" />
      <div className="crt-vignette" />
    </>
  )
}
