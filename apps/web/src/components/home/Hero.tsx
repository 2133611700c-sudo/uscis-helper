import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Globe, Headphones, Scale, Shield, FileText } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { CaseStatusChecker } from './CaseStatusChecker'

interface HeroProps {
  locale: string
}

function MessenginfoMedallion() {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full drop-shadow-[0_0_32px_rgba(212,175,55,0.35)]"
      aria-hidden="true"
    >
      {/* Outer decorative rings */}
      <circle cx="120" cy="120" r="117" stroke="#d4af37" strokeWidth="2.5" />
      <circle cx="120" cy="120" r="109" stroke="#d4af37" strokeWidth="0.8" strokeDasharray="4 3" />

      {/* Background fill */}
      <circle cx="120" cy="120" r="108" fill="#0c1b3a" />

      {/* Circular top text */}
      <defs>
        <path id="arcTop" d="M 30,120 A 90,90 0 0,1 210,120" />
        <path id="arcBot" d="M 38,138 A 90,90 0 0,0 202,138" />
      </defs>
      <text fill="#d4af37" fontSize="10.5" fontFamily="'Arial', sans-serif" letterSpacing="3.2" fontWeight="600">
        <textPath href="#arcTop" startOffset="4%">MESSENGINFO · INFORMATION · SUPPORT</textPath>
      </text>
      <text fill="#d4af37" fontSize="10" fontFamily="'Arial', sans-serif" letterSpacing="2.8" fontWeight="500">
        <textPath href="#arcBot" startOffset="10%">GUIDANCE · DOCUMENTS · HELP</textPath>
      </text>

      {/* Stars at cardinal points */}
      <polygon points="120,9 122.5,16 130,16 124,20.5 126.5,28 120,23.5 113.5,28 116,20.5 110,16 117.5,16" fill="#d4af37" />
      <polygon points="13,120 16,117.5 16,110 20.5,116 28,113.5 23.5,120 28,126.5 20.5,124 16,130 16,122.5" fill="#d4af37" />
      <polygon points="227,120 224,122.5 224,130 219.5,124 212,126.5 216.5,120 212,113.5 219.5,116 224,110 224,117.5" fill="#d4af37" />

      {/* Ukrainian flag bar */}
      <rect x="44" y="92" width="152" height="14" rx="2" fill="#005bbb" />
      <rect x="44" y="106" width="152" height="14" rx="2" fill="#ffd500" />

      {/* Shield body */}
      <path
        d="M 80,62 L 80,148 Q 120,172 160,148 L 160,62 Q 120,55 80,62 Z"
        fill="#0f2352"
        stroke="#d4af37"
        strokeWidth="2"
      />

      {/* Shield inner border */}
      <path
        d="M 86,68 L 86,145 Q 120,165 154,145 L 154,68 Q 120,62 86,68 Z"
        fill="none"
        stroke="#d4af37"
        strokeWidth="0.8"
        strokeOpacity="0.5"
      />

      {/* M letter */}
      <text
        x="120"
        y="122"
        textAnchor="middle"
        fill="white"
        fontSize="44"
        fontWeight="700"
        fontFamily="'Georgia', serif"
      >
        M
      </text>

      {/* Document icon below M */}
      <rect x="108" y="128" width="18" height="22" rx="2" fill="#4f46e5" stroke="#d4af37" strokeWidth="1" />
      <line x1="111" y1="133" x2="123" y2="133" stroke="white" strokeWidth="1.2" />
      <line x1="111" y1="137" x2="123" y2="137" stroke="white" strokeWidth="1.2" />
      <line x1="111" y1="141" x2="120" y2="141" stroke="white" strokeWidth="1.2" />
      {/* Checkmark on doc */}
      <circle cx="129" cy="139" r="6" fill="#22c55e" />
      <polyline points="126,139 128,141 132,137" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Trident symbol (simplified) */}
      <line x1="120" y1="154" x2="120" y2="166" stroke="#ffd500" strokeWidth="2" />
      <line x1="114" y1="156" x2="114" y2="162" stroke="#ffd500" strokeWidth="1.5" />
      <line x1="126" y1="156" x2="126" y2="162" stroke="#ffd500" strokeWidth="1.5" />
      <line x1="114" y1="156" x2="120" y2="152" stroke="#ffd500" strokeWidth="1.5" />
      <line x1="126" y1="156" x2="120" y2="152" stroke="#ffd500" strokeWidth="1.5" />
      <line x1="114" y1="166" x2="126" y2="166" stroke="#ffd500" strokeWidth="1.5" />

      {/* Laurel sprigs */}
      <ellipse cx="61" cy="128" rx="7" ry="3.5" fill="#2d6a2f" transform="rotate(-30 61 128)" />
      <ellipse cx="54" cy="119" rx="7" ry="3.5" fill="#2d6a2f" transform="rotate(-50 54 119)" />
      <ellipse cx="51" cy="108" rx="7" ry="3.5" fill="#2d6a2f" transform="rotate(-70 51 108)" />
      <ellipse cx="179" cy="128" rx="7" ry="3.5" fill="#2d6a2f" transform="rotate(30 179 128)" />
      <ellipse cx="186" cy="119" rx="7" ry="3.5" fill="#2d6a2f" transform="rotate(50 186 119)" />
      <ellipse cx="189" cy="108" rx="7" ry="3.5" fill="#2d6a2f" transform="rotate(70 189 108)" />
    </svg>
  )
}

const disclaimerIcons = [Headphones, FileText, Scale]

export function Hero({ locale }: HeroProps) {
  const t = useTranslations('hero')
  const disclaimerItems = t.raw('disclaimer.items') as string[]

  return (
    <div
      className="relative overflow-hidden bg-[#0a1628]"
      style={{
        minHeight: '560px',
        backgroundImage: 'url(/hero-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      {/* Dark overlay — covers both: missing-image case (gradient only) and photo case (dark tint) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(26,48,96,0.85) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(15,35,82,0.75) 0%, transparent 50%), linear-gradient(135deg, rgba(10,22,40,0.92) 0%, rgba(13,32,64,0.80) 50%, rgba(10,22,40,0.92) 100%)',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Ukrainian flag top-right */}
      <div className="absolute right-4 top-4 z-10 text-3xl leading-none" aria-label="Ukrainian flag">
        🇺🇦
      </div>

      <Container className="relative z-10 py-12 lg:py-16">
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-12">

          {/* Left: Medallion */}
          <div className="w-44 h-44 shrink-0 lg:w-64 lg:h-64">
            <MessenginfoMedallion />
          </div>

          {/* Right: Info panel */}
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 p-6 lg:p-8 text-white"
            style={{ background: 'rgba(10, 22, 40, 0.75)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-baseline gap-2">
              <h1 className="text-4xl font-bold tracking-tight lg:text-5xl" style={{ fontFamily: "'Georgia', serif" }}>
                Messenginfo
              </h1>
              <span className="text-2xl" aria-label="Ukraine">🇺🇦</span>
            </div>

            <p className="mt-2 text-base text-white/75 lg:text-lg">
              {t('subtitle')}
            </p>

            {/* Service Support Only badge */}
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white">
              <Headphones className="h-3.5 w-3.5" />
              {t('disclaimer.badge')}
            </div>

            {/* Disclaimer items */}
            <ul className="mt-4 space-y-3">
              {disclaimerItems.map((item, i) => {
                const Icon = disclaimerIcons[i] ?? Shield
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
                    <span className="text-sm leading-relaxed text-white/70">{item}</span>
                  </li>
                )
              })}
            </ul>

            {/* Domain */}
            <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-sm text-white/40">
              <Globe className="h-4 w-4" />
              <span>messenginfo.com</span>
            </div>

            {/* CTA */}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/services`}
                className="inline-flex items-center gap-2 rounded-[10px] bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {t('ctaServices')}
              </Link>
            </div>
          </div>
        </div>

        {/* Case status checker below hero content */}
        <div className="mt-10 lg:mt-12">
          <CaseStatusChecker />
        </div>
      </Container>
    </div>
  )
}
