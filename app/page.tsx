import Hero from '@/components/Hero'
import HomeUpload from '@/components/HomeUpload'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import FAQ from '@/components/FAQ'

export default function Home() {
  return (
    <div id="page-home">
      <Hero />
      <HomeUpload />
      <HowItWorks />
      <Features />
      <Pricing />
      <FAQ />
    </div>
  )
}
