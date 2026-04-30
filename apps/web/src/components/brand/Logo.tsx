import Link from 'next/link'

interface LogoProps {
  locale: string
  size?: number
}

export function Logo({ locale, size = 32 }: LogoProps) {
  return (
    <Link href={`/${locale}`} className="flex items-center gap-2" aria-label="Messenginfo home">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="7" fill="#4f46e5" />
        <path
          d="M7 22V10h3.2l3.8 7.2L17.8 10H21v12h-3v-6.8L15 20.4h-2l-3-5.2V22H7z"
          fill="white"
        />
        {/* Corner fold — document metaphor */}
        <path d="M25 9l-3-3v3h3z" fill="white" fillOpacity="0.3" />
      </svg>
      <span className="text-xl font-bold text-ink-900">Messenginfo</span>
    </Link>
  )
}
