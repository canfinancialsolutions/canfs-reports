"use client";
import Image from "next/image";
import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export default function NotFound() {
  return (
    <div className={`${inter.className} min-h-screen bg-white`}>
      <div className="max-w-[1000px] mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between gap-2 h-16">
          <div className="flex items-center gap-2 min-w-[520px] pointer-events-none select-none">
            <div className="relative flex-none w-[120px] h-12">
              <div className="absolute inset-0" aria-hidden="true" />
              <Image src="/can-logo.png" alt="CAN Logo" width={120} height={48} priority className="absolute inset-0 h-12 w-[120px] object-contain" />
            </div>
            <div className="h-12 overflow-hidden flex flex-col justify-center">
              <div className="text-2xl font-bold text-blue-800 whitespace-nowrap">CAN Financial Solutions Clients Report</div>
              <div className="text-sm font-semibold text-yellow-500 whitespace-nowrap">Protecting Your Tomorrow</div>
            </div>
          </div>
          <div />
        </header>

        <main className="mt-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Page not found</h1>
            <p className="text-slate-700 mb-4">The page you requested does not exist. Use the button below to go back to Dashboard.</p>
            <Link href="/dashboard" prefetch className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
              <span>Go to Dashboard</span>
              <span aria-hidden>➡️</span>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
