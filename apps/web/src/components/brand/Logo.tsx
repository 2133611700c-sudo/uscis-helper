import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  locale: string
}

export function Logo({ locale }: LogoProps) {
  return (
    <Link href={`/${locale}`} className="flex items-center gap-2.5" aria-label="Messenginfo home">
      <Image
        src="/brand/messenginfo-mark-new.webp"
        alt="Messenginfo"
        width={256}
        height={256}
        className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-[10px]"
        priority
      />
      <span className="font-display text-[1.25rem] sm:text-[1.35rem] md:text-[1.5rem] font-bold text-[#1a2e5a] tracking-tight leading-none">
        Messenginfo
      </span>
    </Link>
  )
}
