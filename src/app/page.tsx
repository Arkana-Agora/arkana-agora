import { CTASection } from "@/components/landing/cta"
import { FAQSection } from "@/components/landing/faq"
import { FeaturesSection } from "@/components/landing/features"
import { Footer } from "@/components/landing/footer"
import { HeroSection } from "@/components/landing/hero"
import { PricingSection } from "@/components/landing/pricing"
import { TrustIndicators } from "@/components/landing/trust-indicators"
import { DailyTarot } from "@/components/tarot/daily-tarot"

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Trust Indicators */}
      <TrustIndicators />

      {/* Daily Tarot */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4">
          <DailyTarot />
        </div>
      </section>

      {/* Features Section */}
      <FeaturesSection />

      {/* Pricing Section */}
      <PricingSection />

      {/* FAQ Section */}
      <FAQSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </main>
  )
}
