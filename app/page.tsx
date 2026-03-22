import Hero from '@/components/Hero'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'

export default function Home() {
  return (
    <div id="page-home">
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
    </div>
  )
}
