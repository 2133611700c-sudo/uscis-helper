import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  locale: string
}

/**
 * Site logo.
 *
 * Per UX audit: on narrow mobile widths the wordmark image alone left
 * users unsure they were still on Messenginfo. We now render an explicit
 * "Messenginfo" text label next to the mark on screens narrower than
 * sm (~640px). On sm+ the full wordmark image stands on its own.
 */
export function Logo({ locale }: LogoProps) {
  return (
    <Link
      href={`/${locale}`}
      className="flex items-center gap-2"
      aria-label="Messenginfo home"
    >
      <Image
        src="/brand/messenginfo-full.webp"
        alt="Messenginfo"
        width={2508}
        height={627}
        className="shrink-0 w-auto h-8 sm:h-9 md:h-10"
        priority
      />
      <span
        className="font-bold text-base sm:hidden"
        style={{ color: 'var(--text-1)', letterSpacing: '0.01em' }}
        aria-hidden="true"
      >
        Messenginfo
      </span>
    </Link>
  )
}
