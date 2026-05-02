import Link from 'next/link'
import Image from 'next/image'

interface LogoProps {
  locale: string
}

export function Logo({ locale }: LogoProps) {
  return (
    <Link href={`/${locale}`} className="flex items-center" aria-label="Messenginfo home">
      <Image
        src="/brand/messenginfo-full.webp"
        alt="Messenginfo"
        width={2508}
        height={627}
        className="shrink-0 w-auto h-8 sm:h-9 md:h-10"
        priority
      />
    </Link>
  )
}
