"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, Brain, Layout } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-4xl z-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-sm font-medium text-primary-foreground/80">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>AI 기반 개인 성장 OS</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 pb-2">
            당신의 성장을 <br />
            <span className="text-primary">AI가 운영합니다.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A.ideal은 단순한 학습 앱이 아닙니다. 직무, 습관, 트렌드까지 관리해주는 당신만의 커리어 운영체제입니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link href="/login">
              <Button size="lg" className="text-lg h-14 px-8 rounded-full shadow-lg shadow-primary/25">
                성장 여정 시작하기 <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="text-lg h-14 px-8 rounded-full glass hover:bg-white/10">
                대시보드 보기
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full px-4"
        >
          <FeatureCard
            icon={<Brain className="w-6 h-6 text-purple-400" />}
            title="AI 커리큘럼"
            description="목표에 맞춰 GPT-5.1이 설계하는 초개인화 학습 로드맵."
          />
          <FeatureCard
            icon={<TrendingUp className="w-6 h-6 text-blue-400" />}
            title="실시간 트렌드"
            description="내 직무에 꼭 필요한 최신 뉴스만 AI가 선별하여 브리핑."
          />
          <FeatureCard
            icon={<Layout className="w-6 h-6 text-pink-400" />}
            title="성장 대시보드"
            description="루틴, 습관, 역량을 하나의 OS에서 통합 관리."
          />
        </motion.div>
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="glass-card p-6 rounded-2xl text-left hover:scale-105 transition-transform duration-300">
      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 border border-white/10">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
