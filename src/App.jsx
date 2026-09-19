import { useState, useEffect, useRef, useCallback } from 'react'

/* ─────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────── */
function pad(n) {
  return String(n).padStart(2, '0')
}

function formatTime(date) {
  const h = date.getHours()
  const m = date.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${pad(m)} ${ampm}`
}

/* ─────────────────────────────────────────────
   ICONS (pure SVG, no deps)
───────────────────────────────────────────── */
function BatteryIcon({ level = 72 }) {
  const fillWidth = Math.round((level / 100) * 20)
  const color = level > 20 ? '#fff' : '#ff453a'
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-label={`Battery ${level}%`}>
      <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="white" strokeOpacity="0.35" />
      <rect x="2" y="2" width={fillWidth} height="8" rx="1.5" fill={color} />
      <rect x="22" y="3.5" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.4" />
    </svg>
  )
}

function SignalIcon() {
  return (
    <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-label="Signal">
      <rect x="0" y="8" width="3" height="4" rx="0.8" fill="white" />
      <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.8" fill="white" />
      <rect x="9" y="3" width="3" height="9" rx="0.8" fill="white" />
      <rect x="13.5" y="0" width="3" height="12" rx="0.8" fill="white" fillOpacity="0.3" />
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-label="WiFi">
      <path d="M8 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z" fill="white" />
      <path d="M4.5 6.8C5.6 5.7 6.7 5.1 8 5.1s2.4.6 3.5 1.7" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M2 4.2C3.7 2.5 5.7 1.5 8 1.5s4.3 1 6 2.7" stroke="white" strokeWidth="1.3" strokeLinecap="round" fill="none" strokeOpacity="0.5" />
    </svg>
  )
}

function FlashlightGlyph({ isOn }) {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      style={{
        filter: isOn
          ? 'drop-shadow(0 0 24px rgba(255,255,180,0.9)) drop-shadow(0 0 48px rgba(255,220,100,0.5))'
          : 'none',
        transition: 'filter 0.3s ease',
      }}
      aria-label="Flashlight"
    >
      {/* body */}
      <rect x="28" y="38" width="24" height="30" rx="4" fill={isOn ? '#ffe066' : '#444'} />
      {/* head */}
      <path d="M22 38 L28 24 L52 24 L58 38 Z" fill={isOn ? '#ffcc00' : '#555'} />
      {/* lens ring */}
      <ellipse cx="40" cy="24" rx="12" ry="4" fill={isOn ? '#fff9c4' : '#666'} />
      {/* beam */}
      {isOn && (
        <path
          d="M28 22 L16 4 M40 20 L40 2 M52 22 L64 4"
          stroke="#fffde0"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}
      {/* button on body */}
      <rect x="35" y="52" width="10" height="6" rx="3" fill={isOn ? '#e6b800' : '#333'} />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#30d158" />
      <path d="M4.5 8.5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="#ffd60a">
      <path d="M7 1l1.5 4H13L9.5 7.5l1.5 4L7 9.5 3 11.5l1.5-4L1 5h4.5z" />
    </svg>
  )
}

/* ─────────────────────────────────────────────
   PAYWALL MODAL
   Renders as position:absolute so it's clipped
   inside the phone's inner screen container.
───────────────────────────────────────────── */
function PaywallModal({ isVisible, onClose, onBuy, buyCount }) {
  const [shimmer, setShimmer] = useState(false)
  const [shake, setShake] = useState(false)
  // 'idle' | 'processing' | 'declined'
  const [payState, setPayState] = useState('idle')
  const [processingStep, setProcessingStep] = useState(0)
  const [progressVal, setProgressVal] = useState(0)
  const processingTimers = useRef([])
  const overlayRef = useRef(null)

  const PROCESSING_STEPS = [
    'Contacting bank…',
    'Verifying card…',
    'Authorizing $499.00…',
    'Almost there…',
  ]

  // reset to idle whenever the sheet closes
  useEffect(() => {
    if (!isVisible) {
      processingTimers.current.forEach(clearTimeout)
      processingTimers.current = []
      setPayState('idle')
      setProcessingStep(0)
      setProgressVal(0)
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible) {
      const t = setTimeout(() => setShimmer(true), 400)
      return () => clearTimeout(t)
    } else {
      setShimmer(false)
    }
  }, [isVisible])

  const handleBuy = () => {
    if (payState === 'processing') return

    // kick off processing sequence
    setPayState('processing')
    setProcessingStep(0)
    setProgressVal(0)

    // cycle status text every 650–750ms
    const stepInterval = 700
    const stepIds = [1, 2, 3].map(i =>
      setTimeout(() => setProcessingStep(i), stepInterval * i)
    )
    processingTimers.current.push(...stepIds)

    // animate progress bar with rAF
    const totalDuration = 1500 + Math.random() * 1300  // 1.5–2.8s
    const startTime = performance.now()
    let rafId
    const tickProgress = (now) => {
      const p = Math.min((now - startTime) / totalDuration, 1)
      setProgressVal(p)
      if (p < 1) rafId = requestAnimationFrame(tickProgress)
    }
    rafId = requestAnimationFrame(tickProgress)
    processingTimers.current.push({ cancel: () => cancelAnimationFrame(rafId) })

    // after total duration → show decline
    const declineId = setTimeout(() => {
      cancelAnimationFrame(rafId)
      setProgressVal(1)
      setPayState('declined')
      onBuy()

      // shake the sheet for drama
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }, totalDuration)
    processingTimers.current.push(declineId)
  }

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      setShake(true)
      setTimeout(() => setShake(false), 600)
    }
  }

  const features = [
    { icon: '🌑', text: 'Unlock the legendary OFF button' },
    { icon: '♾️', text: 'Unlimited off-presses, forever' },
    { icon: '🔋', text: 'Save your battery (eventually)' },
    { icon: '👑', text: 'Priority access to darkness' },
  ]

  const isProcessing = payState === 'processing'

  return (
    <>
      {/* ── backdrop: absolute, clipped by parent overflow:hidden ── */}
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 20,
          background: isVisible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
          backdropFilter: isVisible ? 'blur(4px)' : 'none',
          transition: 'background 0.3s ease',
          pointerEvents: isVisible ? 'all' : 'none',
        }}
      />

      {/* ── sheet: anchored to bottom, never exceeds screen height ──
          maxHeight uses calc(100% - 60px) — 100% is the inner screen
          height (the containing block), minus 60px clears the notch
          area so the sheet can never clip above the screen top.
          display:flex+column pins the header; body div scrolls.     */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 21,
          maxHeight: 'calc(100% - 60px)',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(170deg, #1c1c2e 0%, #12121f 100%)',
          borderRadius: '22px 22px 0 0',
          transform: isVisible ? 'translateY(0)' : 'translateY(105%)',
          transition: 'transform 0.42s cubic-bezier(0.34,1.4,0.64,1)',
          animation: shake ? 'shake 0.5s ease' : 'none',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* drag handle row — dedicated header strip with ✕ in the right */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 14,
          paddingBottom: 10,
          position: 'relative',
          /* give the row enough height so the ✕ floats with clear margin
             above the orange banner and away from the rounded corner */
          minHeight: 44,
        }}>
          {/* pill drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />

          {/* ✕ close button — right-aligned with 14px from edge */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
              flexShrink: 0,
              /* make sure it sits above the banner below */
              zIndex: 2,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
          >
            ✕
          </button>
        </div>

        {/* header gradient banner — compact, no wrapping */}
        <div style={{
          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 40%, #ffcc02 100%)',
          padding: '8px 14px',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,   /* never let the header get squished */
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: shimmer ? 'shimmerBanner 2s infinite' : 'none',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🔦</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                color: '#fff',
                fontSize: 'clamp(13px, 4vw, 15px)',
                fontWeight: 800,
                letterSpacing: -0.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                Flashlight Pro™
              </div>
              <div style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 'clamp(9px, 2.8vw, 11px)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                Premium Darkness Suite
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
                {[...Array(5)].map((_, i) => <StarIcon key={i} />)}
                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 9, marginLeft: 3, whiteSpace: 'nowrap' }}>4.9 • 284K Ratings</span>
              </div>
            </div>
          </div>
        </div>

        {/* body — flex:1 so it fills remaining sheet height and scrolls internally */}
        <div style={{
          padding: '8px 14px 16px',  /* bottom padding ensures fine print clears the clip */
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {/* price callout — hidden during processing */}
          {!isProcessing && (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '7px 10px',
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>One-Time Purchase</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 }}>
                  Unlock the OFF button. Forever.*
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#ffd60a', fontWeight: 800, fontSize: 20 }}>$499</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textDecoration: 'line-through' }}>$999</div>
              </div>
            </div>
          )}

          {/* feature list — wraps naturally, never truncates */}
          {!isProcessing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                  <div style={{ flexShrink: 0, marginTop: 1 }}><CheckIcon /></div>
                  <span style={{
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 'clamp(10px, 3.2vw, 12px)',
                    lineHeight: 1.35,
                  }}>
                    <span style={{ marginRight: 4 }}>{f.icon}</span>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── PROCESSING STATE ── */}
          {isProcessing && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '10px 0 12px',
              gap: 10,
              animation: 'fadeInUp 0.25s ease forwards',
            }}>
              {/* spinner */}
              <div style={{
                width: 28,
                height: 28,
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#f7931e',
                borderRadius: '50%',
                animation: 'spin 0.75s linear infinite',
                flexShrink: 0,
              }} />

              {/* rotating status text */}
              <div style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 12,
                fontWeight: 600,
                minHeight: 18,
                textAlign: 'center',
                animation: 'fadeSwap 0.3s ease',
                key: processingStep,
              }}>
                {PROCESSING_STEPS[processingStep]}
              </div>

              {/* pulsing dots */}
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.4)',
                    animation: `pulseDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>

              {/* progress bar */}
              <div style={{
                width: '100%',
                height: 3,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.08)',
                overflow: 'hidden',
                marginTop: 2,
              }}>
                <div style={{
                  height: '100%',
                  borderRadius: 2,
                  width: `${progressVal * 100}%`,
                  background: 'linear-gradient(90deg, #ff6b35, #ffcc02)',
                  transition: 'width 0.1s linear',
                }} />
              </div>

              {/* fake payment method line */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'rgba(255,255,255,0.35)',
                fontSize: 10,
                marginTop: 2,
              }}>
                <span style={{ fontSize: 12 }}>💳</span>
                Payment method: •••• 4242
              </div>
            </div>
          )}

          {/* decline error banner — shown after processing finishes */}
          {!isProcessing && buyCount > 0 && (
            <div style={{
              background: 'rgba(255,59,48,0.15)',
              border: '1px solid rgba(255,59,48,0.3)',
              borderRadius: 8,
              padding: '5px 10px',
              marginBottom: 8,
              color: '#ff453a',
              fontSize: 'clamp(9px, 2.8vw, 10px)',
              textAlign: 'center',
              fontWeight: 600,
              lineHeight: 1.3,
              animation: 'fadeInUp 0.3s ease forwards',
            }}>
              💸 {buyCount === 1
                ? 'Insufficient balance. You need $499.00 to unlock darkness.'
                : buyCount === 2
                ? 'Still not enough balance. Darkness remains locked.'
                : `Attempt #${buyCount}: Balance $0.00. Darkness: $499.00. 🤷`}
            </div>
          )}

          {/* CTA button — loading state during processing */}
          <button
            onClick={handleBuy}
            disabled={isProcessing}
            style={{
              width: '100%',
              minHeight: 44,
              padding: '11px 16px',   /* explicit horizontal padding keeps text off edges */
              borderRadius: 12,
              border: 'none',
              background: isProcessing
                ? 'rgba(255,255,255,0.08)'
                : 'linear-gradient(135deg, #ff6b35, #f7931e, #ffcc02)',
              backgroundSize: '200% 100%',
              animation: !isProcessing && shimmer ? 'shimmerBtn 2s infinite' : 'none',
              color: isProcessing ? 'rgba(255,255,255,0.4)' : '#fff',
              fontWeight: 800,
              /* At 360px frame the inner sheet is ~308px wide minus 28px padding = ~280px
                 for the button. "🔓 Unlock OFF — $499.00" at 13px bold fits in ~260px. */
              fontSize: 'clamp(12px, 3.4vw, 14px)',
              letterSpacing: 0,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              boxShadow: isProcessing ? 'none' : '0 3px 16px rgba(247,147,30,0.5)',
              transition: 'background 0.3s ease, box-shadow 0.3s ease, color 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              /* one line only — overflow:hidden stops bleed; NO text-overflow:ellipsis
                 so the price is never replaced with "…"                         */
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
            aria-label={isProcessing ? 'Processing payment' : 'Unlock OFF button for $499'}
          >
            {isProcessing ? (
              <>
                <div style={{
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.15)',
                  borderTopColor: 'rgba(255,255,255,0.6)',
                  borderRadius: '50%',
                  animation: 'spin 0.75s linear infinite',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13 }}>Processing…</span>
              </>
            ) : (
              <span style={{ textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                🔓 Unlock OFF — $499.00
              </span>
            )}
          </button>

          {/* fine print */}
          <div style={{
            color: 'rgba(255,255,255,0.3)',
            fontSize: 9,
            textAlign: 'center',
            marginTop: 6,
            lineHeight: 1.4,
          }}>
            that's only $1.37/day over 1 year. Non-refundable. Darkness not guaranteed.{' '}
            By tapping you agree to our{' '}
            <span style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>
            ,{' '}
            <span style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
            , and{' '}
            <span style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline', cursor: 'pointer' }}>Darkness Disclaimer</span>.
          </div>

          {/* restore purchase */}
          <div style={{ textAlign: 'center', margin: '4px 0 4px' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.22)',
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '10px 8px',
                minHeight: 44,
              }}
            >
              Restore Purchase
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmerBanner {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes shimmerBtn {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0) translateY(0); }
          15% { transform: translateX(-6px) translateY(0); }
          30% { transform: translateX(6px) translateY(0); }
          45% { transform: translateX(-4px) translateY(0); }
          60% { transform: translateX(4px) translateY(0); }
          75% { transform: translateX(-2px) translateY(0); }
          90% { transform: translateX(2px) translateY(0); }
        }
        @keyframes pulseDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40%            { opacity: 1;    transform: scale(1.2); }
        }
        @keyframes fadeSwap {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </>
  )
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function App() {
  const [isOn, setIsOn] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [buyCount, setBuyCount] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [battery, setBattery] = useState(72)
  // countdown in seconds — starts at 8h 43m when turned ON
  const [darkEta, setDarkEta] = useState(8 * 3600 + 43 * 60)
  const [btnPressed, setBtnPressed] = useState(null) // 'on' | 'off'
  const [flashOn, setFlashOn] = useState(false)

  // ── battery-death state machine ──
  // 'normal' | 'dying' | 'dead' | 'rebooting'
  const [phoneState, setPhoneState] = useState('normal')
  const [holdProgress, setHoldProgress] = useState(0) // 0–1 during long-press
  const [rebootToast, setRebootToast] = useState(false)
  const holdTimerRef = useRef(null)
  const holdRAFRef = useRef(null)
  const holdStartRef = useRef(null)
  const HOLD_DURATION = 1800 // ms to trigger reboot

  // double-tap tracking for secret escape
  const tapTimerRef = useRef(null)
  const tapCountRef = useRef(0)

  // tick clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  // tick countdown while on (and alive)
  useEffect(() => {
    if (!isOn || phoneState !== 'normal') return
    const t = setInterval(() => {
      setDarkEta(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [isOn, phoneState])

  // drain battery while on — stop at 0 and trigger death
  useEffect(() => {
    if (!isOn || phoneState !== 'normal') return
    const t = setInterval(() => {
      setBattery(prev => {
        if (prev <= 1) {
          // trigger power-off sequence
          setPhoneState('dying')
          return 0
        }
        return prev - 1
      })
    }, 4000)
    return () => clearInterval(t)
  }, [isOn, phoneState])

  // when dying → wait for fade animation → go dead
  useEffect(() => {
    if (phoneState !== 'dying') return
    const t = setTimeout(() => setPhoneState('dead'), 1300)
    return () => clearTimeout(t)
  }, [phoneState])

  const darkHours = Math.floor(darkEta / 3600)
  const darkMins = Math.floor((darkEta % 3600) / 60)

  const isDead = phoneState === 'dead' || phoneState === 'dying' || phoneState === 'rebooting'

  const handleTurnOn = () => {
    if (isDead) return
    setBtnPressed('on')
    setTimeout(() => setBtnPressed(null), 200)
    if (!isOn) {
      setFlashOn(true)
      setTimeout(() => setFlashOn(false), 120)
      setIsOn(true)
      setDarkEta(8 * 3600 + 43 * 60 + Math.floor(Math.random() * 600))
    }
  }

  const handleTurnOff = () => {
    if (isDead) return
    setBtnPressed('off')
    setTimeout(() => setBtnPressed(null), 200)
    setShowPaywall(true)
  }

  const handleBuy = () => {
    setBuyCount(c => c + 1)
  }

  const handleRestorePurchase = () => {
    setShowPaywall(false)
  }

  // secret escape: double-tap on the status bar area
  const handleStatusBarTap = useCallback(() => {
    if (isDead) return
    tapCountRef.current += 1
    if (tapCountRef.current === 1) {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0
      }, 400)
    } else if (tapCountRef.current >= 2) {
      clearTimeout(tapTimerRef.current)
      tapCountRef.current = 0
      setIsOn(false)
      setShowPaywall(false)
      setBuyCount(0)
    }
  }, [isDead])

  // ── long-press reboot handlers ──
  const cancelHold = useCallback(() => {
    clearTimeout(holdTimerRef.current)
    cancelAnimationFrame(holdRAFRef.current)
    holdStartRef.current = null
    setHoldProgress(0)
  }, [])

  const handleDeadPointerDown = useCallback((e) => {
    if (phoneState !== 'dead') return
    e.preventDefault()
    holdStartRef.current = performance.now()
    setHoldProgress(0)

    const tick = () => {
      if (!holdStartRef.current) return
      const elapsed = performance.now() - holdStartRef.current
      const p = Math.min(elapsed / HOLD_DURATION, 1)
      setHoldProgress(p)
      if (p < 1) {
        holdRAFRef.current = requestAnimationFrame(tick)
      }
    }
    holdRAFRef.current = requestAnimationFrame(tick)

    holdTimerRef.current = setTimeout(() => {
      holdStartRef.current = null
      setHoldProgress(1)
      // trigger reboot sequence
      setPhoneState('rebooting')
      setTimeout(() => {
        // full state reset → standby
        setIsOn(false)
        setShowPaywall(false)
        setBuyCount(0)
        setBattery(100)
        setDarkEta(8 * 3600 + 43 * 60)
        setPhoneState('normal')
        // show toast punchline
        setRebootToast(true)
        setTimeout(() => setRebootToast(false), 3000)
      }, 1600)
    }, HOLD_DURATION)
  }, [phoneState, cancelHold])

  const handleDeadPointerUp = useCallback(() => {
    if (phoneState !== 'dead') return
    cancelHold()
  }, [phoneState, cancelHold])

  // background color
  const bgColor = isOn && phoneState === 'normal' ? '#fffde7' : '#0a0a0a'
  const textColor = isOn && phoneState === 'normal' ? '#1a1208' : '#fff'

  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111',
        /* Tighter padding on small screens; landscape uses less vertical room */
        padding: 'clamp(12px, 3vmin, 24px)',
        boxSizing: 'border-box',
      }}
    >
      {/* landscape + small-screen sizing overrides via injected media query */}
      <style>{`
        /* In landscape, let height drive the phone size instead of width */
        @media (orientation: landscape) {
          .phone-bezel {
            width: auto !important;
            height: min(calc(100dvh - 24px), 500px) !important;
            aspect-ratio: 9 / 19.5 !important;
          }
        }
        /* On very small screens (≤390px) tighten the bezel border-radius */
        @media (max-width: 390px) {
          .phone-bezel { border-radius: 44px !important; }
          .phone-screen { border-radius: 34px !important; }
        }
      `}</style>
      {/* ══════════════════════════════════════════
          OUTER BEZEL — physical iPhone casing
          Width capped at 330px; aspect-ratio
          9:19.5 makes it look tall & narrow.
          Side buttons are children of this layer
          so they read as part of the casing.
      ══════════════════════════════════════════ */}
      <div
        className="phone-bezel"
        style={{
          /* Portrait: width drives, capped at 390px.
             On 360px screens: 360-24 = 336px, on 390px: 366px, on 430px+: 390px.
             Landscape override via .phone-bezel media query above.          */
          width: 'min(430px, calc(100vw - 24px))',
          maxHeight: 'calc(100dvh - 24px)',
          aspectRatio: '9 / 19.5',
          flexShrink: 0,
          /* Casing look */
          background: 'linear-gradient(160deg, #2a2a2a 0%, #111 50%, #1e1e1e 100%)',
          borderRadius: 50,
          padding: 10,
          boxSizing: 'border-box',
          position: 'relative',
          /* Depth / float */
          boxShadow: isOn && phoneState === 'normal'
            ? `0 0 0 1px #3a3a3a,
               0 40px 80px -20px rgba(0,0,0,0.75),
               0 8px 32px rgba(0,0,0,0.5),
               0 0 60px 16px rgba(255,220,60,0.18)`
            : `0 0 0 1px #3a3a3a,
               0 40px 80px -20px rgba(0,0,0,0.75),
               0 8px 32px rgba(0,0,0,0.5)`,
          transition: 'box-shadow 0.4s ease',
          userSelect: 'none',
        }}
      >
        {/* ── LEFT SIDE BUTTONS (mute + volume) ── */}
        {/* mute switch */}
        <div style={{
          position: 'absolute', left: -3.5,
          top: '10%', width: 3.5, height: 22,
          background: 'linear-gradient(90deg, #0a0a0a, #2a2a2a)',
          borderRadius: '3px 0 0 3px',
          boxShadow: '-1px 0 3px rgba(0,0,0,0.6)',
        }} />
        {/* volume up */}
        <div style={{
          position: 'absolute', left: -3.5,
          top: 'calc(10% + 38px)', width: 3.5, height: 44,
          background: 'linear-gradient(90deg, #0a0a0a, #2a2a2a)',
          borderRadius: '3px 0 0 3px',
          boxShadow: '-1px 0 3px rgba(0,0,0,0.6)',
        }} />
        {/* volume down */}
        <div style={{
          position: 'absolute', left: -3.5,
          top: 'calc(10% + 94px)', width: 3.5, height: 44,
          background: 'linear-gradient(90deg, #0a0a0a, #2a2a2a)',
          borderRadius: '3px 0 0 3px',
          boxShadow: '-1px 0 3px rgba(0,0,0,0.6)',
        }} />

        {/* ── RIGHT SIDE BUTTON (power) ── */}
        <div style={{
          position: 'absolute', right: -3.5,
          top: '18%', width: 3.5, height: 64,
          background: 'linear-gradient(270deg, #0a0a0a, #2a2a2a)',
          borderRadius: '0 3px 3px 0',
          boxShadow: '1px 0 3px rgba(0,0,0,0.6)',
        }} />

        {/* ══════════════════════════════════════
            INNER SCREEN — the glass display
            Slightly smaller radius so the bezel
            wraps evenly on all sides.
        ══════════════════════════════════════ */}
        <div
          className="phone-screen"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 40,
            background: bgColor,
            overflow: 'hidden',
            position: 'relative',
            transition: 'background 0.4s ease',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* screen flash — absolute so it's clipped to the screen */}
          {flashOn && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,220,0.85)',
              zIndex: 30,
              pointerEvents: 'none',
              borderRadius: 40,
              animation: 'flashFade 0.12s ease-out forwards',
            }} />
          )}
          {/* ── NOTCH — inset into screen top ── */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            /* ~33% of screen width scales with the frame */
            width: 'min(110px, 33%)',
            height: 30,
            background: '#131313',
            borderRadius: '0 0 20px 20px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#0a0a0a',
              boxShadow: 'inset 0 0 3px rgba(100,200,255,0.25)',
            }} />
            <div style={{ width: 32, height: 5, borderRadius: 3, background: '#0a0a0a' }} />
          </div>

          {/* status bar — double-tap to escape */}
          <div
            onClick={handleStatusBarTap}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 6% 0',
              marginTop: 10,
              position: 'relative',
              zIndex: 5,
              cursor: 'default',
              minHeight: 44, /* ensures tappable even on small screens */
            }}
            aria-label="Status bar (double-tap for secret action)"
          >
            <span style={{ color: textColor, fontWeight: 700, fontSize: 14, letterSpacing: -0.3, transition: 'color 0.4s' }}>
              {formatTime(currentTime)}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon level={battery} />
            </div>
          </div>

          {/* secret hint — tiny, easy to miss */}
          <div style={{
            textAlign: 'center',
            fontSize: 7,
            color: isOn ? 'rgba(80,60,0,0.22)' : 'rgba(255,255,255,0.1)',
            marginTop: 1,
            letterSpacing: 0.2,
            transition: 'color 0.4s',
            lineHeight: 1,
          }}>
            double-tap status bar to exit demo mode
          </div>

          {/* app title */}
          <div style={{ textAlign: 'center', marginTop: 'clamp(6px, 2.5%, 18px)' }}>
            <div style={{
              color: textColor,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.8,
              opacity: 0.5,
              transition: 'color 0.4s',
            }}>
              FLASHLIGHT PRO™
            </div>
          </div>

          {/* ── MAIN CONTENT AREA ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(10px, 3%, 20px)',
            padding: '0 20px',
            minHeight: 0,
            overflow: 'hidden',
          }}>
            {/* flashlight glyph */}
            <div style={{
              background: isOn ? 'rgba(255,240,100,0.3)' : 'rgba(255,255,255,0.05)',
              borderRadius: '50%',
              width: 'clamp(90px, 36%, 140px)',
              height: 'clamp(90px, 36%, 140px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.4s ease',
              boxShadow: isOn ? '0 0 50px 16px rgba(255,230,50,0.2)' : 'none',
            }}>
              <FlashlightGlyph isOn={isOn} />
            </div>

            {/* status text */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                color: textColor,
                fontSize: 'clamp(16px, 5vw, 26px)',
                fontWeight: 700,
                letterSpacing: -0.5,
                transition: 'color 0.4s',
              }}>
                {isOn ? 'ILLUMINATING' : 'STANDBY'}
              </div>
              <div style={{
                color: isOn ? 'rgba(80,60,0,0.6)' : 'rgba(255,255,255,0.4)',
                fontSize: 12,
                marginTop: 3,
                transition: 'color 0.4s',
              }}>
                {isOn
                  ? `est. darkness in ${darkHours}h ${darkMins}m`
                  : 'Tap ON to illuminate'}
              </div>
            </div>

            {/* battery info card */}
            <div style={{
              background: isOn ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: '9px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              transition: 'background 0.4s',
              width: 'min(200px, 72%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%' }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>🔋</span>
                <div style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 4,
                  background: isOn ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${battery}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: battery > 30
                      ? 'linear-gradient(90deg, #30d158, #34c759)'
                      : battery > 15
                      ? 'linear-gradient(90deg, #ff9f0a, #ffcc00)'
                      : 'linear-gradient(90deg, #ff453a, #ff6b35)',
                    transition: 'width 0.5s ease, background 0.5s',
                  }} />
                </div>
                <span style={{
                  color: isOn ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>
                  {battery}%
                </span>
              </div>
              {isOn && battery < 20 && (
                <div style={{ color: '#ff453a', fontSize: 10, fontWeight: 600, animation: 'pulse 1s infinite' }}>
                  ⚠️ Low battery — please purchase OFF button
                </div>
              )}
              {isOn && (
                <div style={{ color: 'rgba(0,0,0,0.35)', fontSize: 9 }}>
                  Draining at maximum efficiency
                </div>
              )}
            </div>
          </div>

          {/* ── BOTTOM CONTROLS ── */}
          <div style={{
            padding: '10px 6% clamp(16px, 5%, 34px)',
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
          }}>
            {/* ON button — min 44px tall for thumb targets */}
            <button
              onClick={handleTurnOn}
              style={{
                flex: 1,
                minHeight: 44,
                padding: '13px 0',
                borderRadius: 50,
                border: 'none',
                background: isOn
                  ? 'rgba(0,0,0,0.12)'
                  : 'linear-gradient(135deg, #ffe259, #ffa751)',
                color: isOn ? 'rgba(0,0,0,0.4)' : '#1a1208',
                fontWeight: 800,
                fontSize: 'clamp(14px, 4vw, 16px)',
                letterSpacing: 0.3,
                cursor: isOn ? 'default' : 'pointer',
                transform: btnPressed === 'on' ? 'scale(0.93)' : 'scale(1)',
                transition: 'transform 0.15s cubic-bezier(0.34,1.6,0.64,1), background 0.4s, color 0.4s, box-shadow 0.4s',
                boxShadow: isOn ? 'none' : '0 5px 20px rgba(255,180,50,0.4)',
              }}
              aria-label="Turn flashlight on (free)"
            >
              ON
            </button>

            {/* OFF button — FAKE, also min 44px */}
            <button
              onClick={handleTurnOff}
              style={{
                flex: 1,
                minHeight: 44,
                padding: '13px 0',
                borderRadius: 50,
                border: isOn ? '2px solid rgba(0,0,0,0.2)' : '2px solid rgba(255,255,255,0.1)',
                background: isOn ? 'transparent' : 'rgba(255,255,255,0.06)',
                color: isOn ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.3)',
                fontWeight: 800,
                fontSize: 'clamp(14px, 4vw, 16px)',
                letterSpacing: 0.3,
                cursor: 'pointer',
                transform: btnPressed === 'off' ? 'scale(0.93)' : 'scale(1)',
                transition: 'transform 0.15s cubic-bezier(0.34,1.6,0.64,1), background 0.4s, color 0.4s, border 0.4s',
                position: 'relative',
              }}
              aria-label="Turn flashlight off (requires purchase)"
            >
              OFF
            </button>
          </div>

          {/* ── PAYWALL — lives inside the screen, clipped by overflow:hidden ── */}
          <PaywallModal
            isVisible={showPaywall}
            onClose={handleRestorePurchase}
            onBuy={handleBuy}
            buyCount={buyCount}
          />

          {/* ── DYING OVERLAY — fades to black over 1.2s ── */}
          {phoneState === 'dying' && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: '#000',
              zIndex: 50,
              pointerEvents: 'none',
              animation: 'screenDie 1.2s ease-in forwards',
              borderRadius: 40,
            }} />
          )}

          {/* ── DEAD SCREEN — pure black, captures long-press ── */}
          {(phoneState === 'dead' || phoneState === 'rebooting') && (
            <div
              onPointerDown={handleDeadPointerDown}
              onPointerUp={handleDeadPointerUp}
              onPointerLeave={handleDeadPointerUp}
              onPointerCancel={handleDeadPointerUp}
              style={{
                position: 'absolute',
                inset: 0,
                background: '#000',
                zIndex: 50,
                borderRadius: 40,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                cursor: phoneState === 'dead' ? 'pointer' : 'default',
                userSelect: 'none',
                touchAction: 'none',
              }}
            >
              {phoneState === 'rebooting' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 16,
                  animation: 'fadeInUp 0.4s ease forwards',
                }}>
                  {/* Apple-style logo */}
                  <svg width="42" height="50" viewBox="0 0 42 50" fill="white" opacity="0.9">
                    <path d="M34.2 26.1c0-5.2 4.3-7.7 4.5-7.8-2.4-3.6-6.2-4-7.6-4.1-3.2-.3-6.3 1.9-7.9 1.9-1.7 0-4.2-1.9-6.9-1.8-3.5.1-6.8 2.1-8.6 5.2-3.7 6.4-.9 15.8 2.6 21 1.8 2.5 3.8 5.4 6.5 5.3 2.6-.1 3.6-1.7 6.8-1.7 3.1 0 4 1.7 6.8 1.6 2.8 0 4.6-2.6 6.3-5.1 2-2.9 2.8-5.7 2.9-5.8-.1 0-5.4-2.1-5.4-8.7zM29 11.4c1.4-1.8 2.4-4.2 2.1-6.7-2 .1-4.5 1.4-5.9 3.1-1.3 1.5-2.4 3.9-2.1 6.3 2.2.2 4.5-1.1 5.9-2.7z"/>
                  </svg>
                  <div style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    letterSpacing: 0.5,
                    fontWeight: 500,
                  }}>
                    restarting…
                  </div>
                  {/* spinner ring */}
                  <div style={{
                    width: 20,
                    height: 20,
                    border: '2px solid rgba(255,255,255,0.15)',
                    borderTopColor: 'rgba(255,255,255,0.7)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              )}

              {phoneState === 'dead' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  {/* hold-progress arc ring */}
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                    {/* track */}
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                    {/* progress */}
                    <circle cx="32" cy="32" r="26" fill="none"
                      stroke="rgba(255,255,255,0.55)" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - holdProgress)}`}
                      style={{ transition: holdProgress === 0 ? 'none' : 'stroke-dashoffset 0.05s linear' }}
                    />
                    {/* center power icon */}
                    <g transform="rotate(90 32 32)">
                      <circle cx="32" cy="32" r="7" fill="none"
                        stroke={holdProgress > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'}
                        strokeWidth="2"
                        strokeDasharray="36 6"
                        style={{ transition: 'stroke 0.2s' }}
                      />
                      <line x1="32" y1="22" x2="32" y2="28"
                        stroke={holdProgress > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'}
                        strokeWidth="2.5" strokeLinecap="round"
                        style={{ transition: 'stroke 0.2s' }}
                      />
                    </g>
                  </svg>
                  <div style={{
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: 10,
                    letterSpacing: 0.3,
                    fontWeight: 500,
                    textAlign: 'center',
                    lineHeight: 1.4,
                  }}>
                    {holdProgress > 0.05 ? 'keep holding…' : 'hold to restart'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── REBOOT TOAST — punchline after revive ── */}
          {rebootToast && (
            <div style={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              background: 'rgba(30,30,40,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '9px 14px',
              /* allow wrapping on narrow frames; cap width to 90% */
              width: 'max-content',
              maxWidth: '88%',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 11,
              fontWeight: 500,
              lineHeight: 1.4,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              animation: 'toastIn 0.3s ease forwards',
              pointerEvents: 'none',
            }}>
              Welcome back. Still $499 to turn it off. 🔦
            </div>
          )}

        </div>{/* /inner screen */}
      </div>{/* /outer bezel */}

      {/* global keyframes */}
      <style>{`
        @keyframes flashFade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmerBtn {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes screenDie {
          0%   { opacity: 0; }
          30%  { opacity: 0.2; }
          70%  { opacity: 0.7; }
          85%  { opacity: 0.95; }
          100% { opacity: 1; }
        }
        @keyframes fadeInUp {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes toastIn {
          0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        button:active {
          opacity: 0.85;
        }
      `}</style>
    </div>
  )
}
