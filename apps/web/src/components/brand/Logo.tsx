import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  locale: string
}

export function Logo({ locale }: LogoProps) {
  return (
    <Link href={`/${locale}`} className="flex items-center gap-2" aria-label="Messenginfo home">
      <Image
        src="/brand/messenginfo-full.png"
        alt="Messenginfo"
        width={2508}
        height={627}
        className="shrink-0 w-auto h-11 sm:h-12 md:h-14"
        priority
      />
    </Link>
  )
}
