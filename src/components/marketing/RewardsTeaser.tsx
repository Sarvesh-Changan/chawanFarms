import { ArrowRight, Camera, Gift, Share2 } from "lucide-react";
import Link from "next/link";

export function RewardsTeaser() {
  const steps = [
    { icon: Camera, title: "Share your farm story", text: "Send us a video from your visit." },
    { icon: Share2, title: "We review it", text: "The team moderates every submission." },
    { icon: Gift, title: "Enjoy savings", text: "Approved stories can lead to future rewards." },
  ];
  return (
    <div className="bg-turmeric-500 text-ink-900 rounded-[1.5rem] p-6 sm:p-10">
      <div className="max-w-2xl"><p className="text-forest-700 text-xs font-semibold tracking-[0.2em] uppercase">A little loop back</p><h3 className="font-heading mt-3 text-4xl leading-tight sm:text-5xl">Your farm story can help the next guest arrive curious.</h3><p className="mt-4 max-w-xl leading-7">Share your farm story → earn points → enjoy savings on your next visit. Reward values are not shown until the live rules are confirmed.</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">{steps.map(({ icon: Icon, title, text }, index) => <div className="border-ink-900/20 relative border-t pt-4" key={title}><span className="bg-forest-900 text-turmeric-500 grid size-10 place-items-center rounded-full"><Icon aria-hidden="true" className="size-5" /></span><h4 className="mt-4 font-semibold">{title}</h4><p className="mt-1 text-sm leading-6 opacity-75">{text}</p>{index < steps.length - 1 ? <ArrowRight aria-hidden="true" className="text-forest-700 absolute top-8 right-2 hidden size-5 md:block" /> : null}</div>)}</div>
      <Link href="/rewards" className="text-forest-900 mt-8 inline-flex min-h-11 items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-forest-900">How rewards work →</Link>
    </div>
  );
}
