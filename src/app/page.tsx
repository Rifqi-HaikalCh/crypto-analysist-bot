import { TrendingUp, Shield, Zap, MessageSquare } from "lucide-react";
import ChatInterface from "@/components/chat-interface";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-cyan-500/30">
      {/* Hero Section */}
      <main className="container mx-auto px-6 pt-24 pb-16">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span>Live Crypto Analysis Active</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
            Crypto Analysist Bot
          </h1>
          
          <p className="max-w-2xl text-lg md:text-xl text-slate-400 leading-relaxed">
            Your intelligent companion for real-time market insights, automated technical analysis, and sentiment tracking.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <a href="#chat" className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-all shadow-lg shadow-cyan-900/20">
              Start Chatting
            </a>
            <button className="px-8 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg font-semibold transition-all">
              View Analytics
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <FeatureCard 
            icon={<TrendingUp className="w-6 h-6 text-cyan-400" />}
            title="Market Insights"
            description="Get real-time updates on price movements and market trends across major exchanges."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6 text-cyan-400" />}
            title="Safe & Secure"
            description="Bank-grade encryption and privacy-focused analysis for your crypto assets."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-cyan-400" />}
            title="Instant Alerts"
            description="Never miss a pump or dump with our highly customizable notification system."
          />
        </div>

        {/* Chat Section */}
        <div id="chat" className="mt-32 scroll-mt-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Talk to the Bot</h2>
            <p className="text-slate-400">Ask questions about Bitcoin, Ethereum, or any trending coin.</p>
          </div>
          <ChatInterface />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-12 text-center text-slate-500 text-sm">
        <p>© 2026 Crypto Analysist Bot. Built with Next.js 16 (App Router).</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/30 transition-colors group">
      <div className="mb-4 inline-block">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 group-hover:text-cyan-400 transition-colors">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
