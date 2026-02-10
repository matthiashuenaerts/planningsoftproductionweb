import React from "react";
import { Link } from "react-router-dom";
import thononLogo from "@/assets/thonon-logo.png";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Calendar,
  ClipboardList,
  Factory,
  Layers,
  Shield,
  Truck,
  Users,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const features = [
  {
    icon: Factory,
    title: "Workstation Management",
    description:
      "Real-time overview of all production workstations with task assignments and progress tracking.",
  },
  {
    icon: Calendar,
    title: "Production Planning",
    description:
      "Gantt charts, drag-and-drop scheduling, and automatic capacity optimization.",
  },
  {
    icon: ClipboardList,
    title: "Order Management",
    description:
      "Track orders from intake through production to delivery with full traceability.",
  },
  {
    icon: Truck,
    title: "Logistics",
    description:
      "Manage incoming deliveries, truck loading, and outgoing shipments seamlessly.",
  },
  {
    icon: Users,
    title: "Team Coordination",
    description:
      "Installation teams, employee scheduling, holiday management, and time registration.",
  },
  {
    icon: BarChart3,
    title: "Dashboards & Insights",
    description:
      "Live production dashboards, broken-parts tracking, and key performance indicators.",
  },
  {
    icon: Layers,
    title: "Cabinet Calculation",
    description:
      "3D cabinet model builder with material calculation, pricing, and quote generation.",
  },
  {
    icon: Shield,
    title: "Multi-Tenant Security",
    description:
      "Each company gets an isolated environment with role-based access control.",
  },
];

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0B1120] text-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0B1120]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
              alt="Logo"
              className="h-8 w-auto rounded"
            />
            <span className="font-bold text-lg">
              <span className="text-[#195F85]">AutoMattiOn</span>{" "}
              <span className="text-[#42A5DB]">Compass</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/dev/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                Developer Portal
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-sm text-blue-300 mb-8">
            <CheckCircle2 className="h-4 w-4" />
            Production planning made simple
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#42A5DB] to-[#195F85]">
              Guiding your production
            </span>
            <br />
            <span className="text-white">to perfection</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            The all-in-one production planning platform for furniture manufacturers.
            Manage workstations, orders, logistics, and teams — all from one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:info@automattion.com">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-8 h-12 text-base font-semibold shadow-lg shadow-blue-500/25"
              >
                Request a Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <Link to="/thonon/nl">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 hover:bg-white/10 text-white px-6 h-12 text-base font-semibold gap-3"
              >
                <img src={thononLogo} alt="Thonon" className="h-6 w-auto" />
                Thonon Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to run production
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              A complete suite of tools designed specifically for furniture and interior manufacturers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-blue-500/30 transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to streamline your production?
          </h2>
          <p className="text-slate-400 mb-8">
            Get your own dedicated environment at{" "}
            <code className="text-blue-300">yourcompany.automattion-compass.com</code>
          </p>
          <a href="mailto:info@automattion.com">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#195F85] to-[#42A5DB] hover:from-[#164f70] hover:to-[#3994c5] text-white px-8 h-12"
            >
              Contact Us
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png"
              alt="Logo"
              className="h-6 w-auto rounded"
            />
            <span className="text-sm text-slate-400">
              © {new Date().getFullYear()} AutoMattiOn Compass. All rights reserved.
            </span>
          </div>
          <Link
            to="/dev/login"
            className="text-sm text-slate-500 hover:text-slate-300 transition"
          >
            Developer Access
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
