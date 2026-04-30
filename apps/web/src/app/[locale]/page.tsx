import { HeroSection } from '@/components/sections/HeroSection';
import { ServicesSection } from '@/components/sections/ServicesSection';
import { HowItWorksSection } from '@/components/sections/HowItWorksSection';
import { WhyMessenginfoSection } from '@/components/sections/WhyMessenginfoSection';
import { ContactSection } from '@/components/sections/ContactSection';
import { DisclaimerSection } from '@/components/sections/DisclaimerSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <HowItWorksSection />
      <WhyMessenginfoSection />
      <ContactSection />
      <DisclaimerSection />
    </>
  );
}
