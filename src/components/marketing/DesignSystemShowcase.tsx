"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ParallaxImage } from "@/components/motion/ParallaxImage";
import { Reveal } from "@/components/motion/Reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const COLOR_TOKENS = [
  ["forest-900", "--forest-900"],
  ["forest-700", "--forest-700"],
  ["leaf-500", "--leaf-500"],
  ["paddy-300", "--paddy-300"],
  ["laterite-600", "--laterite-600"],
  ["turmeric-500", "--turmeric-500"],
  ["cream-50", "--cream-50"],
  ["clay-100", "--clay-100"],
  ["ink-900", "--ink-900"],
  ["mist-500", "--mist-500"],
  ["night-900", "--night-900"],
] as const;

export function DesignSystemShowcase() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-8 lg:px-12">
      <Toaster />
      <div className="mx-auto max-w-7xl space-y-16">
        <header className="max-w-3xl space-y-4">
          <Badge>Design foundation</Badge>
          <h1 className="font-heading text-forest-900 text-5xl leading-[1.08] tracking-tight sm:text-7xl">
            Chawan Farms UI system
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-mist-500">
            Development-only reference for tokens, typography, primitives, and
            motion.
          </p>
        </header>

        <section aria-labelledby="type-scale" className="space-y-6">
          <SectionHeading
            id="type-scale"
            eyebrow="Typography"
            title="Type scale"
          />
          <div className="border-border bg-card grid gap-6 rounded-2xl border p-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-mist-500 uppercase">
                H1 · 40 → 84
              </p>
              <h2 className="font-heading text-[clamp(2.5rem,7vw,5.25rem)] leading-[1.08]">
                Display heading
              </h2>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-mist-500 uppercase">
                H2 · 30 → 56
              </p>
              <h3 className="font-heading text-[clamp(1.875rem,5vw,3.5rem)] leading-[1.1]">
                Section heading
              </h3>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-mist-500 uppercase">
                H3 · 22 → 32
              </p>
              <h4 className="font-heading text-[clamp(1.375rem,3vw,2rem)] leading-[1.15]">
                Card heading
              </h4>
            </div>
            <p className="max-w-[65ch] text-base leading-7">
              Body text uses Inter with a comfortable reading measure. देवनागरी
              text uses the configured Noto Sans Devanagari face.
            </p>
            <p className="text-sm text-mist-500">Small text · 14px</p>
          </div>
        </section>

        <section aria-labelledby="colors" className="space-y-6">
          <SectionHeading id="colors" eyebrow="Tokens" title="Colour tokens" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COLOR_TOKENS.map(([name, variable]) => (
              <div
                key={name}
                className="border-border bg-card overflow-hidden rounded-xl border"
              >
                <div
                  className="h-20"
                  style={{ backgroundColor: `var(${variable})` }}
                />
                <div className="space-y-1 p-3">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="font-mono text-xs text-mist-500">{variable}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="primitives" className="space-y-6">
          <SectionHeading
            id="primitives"
            eyebrow="Components"
            title="Primitives"
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>
                  All controls keep visible focus states and 44px touch targets.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fields</CardTitle>
                <CardDescription>
                  Input, textarea, select, and checkbox.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  aria-label="Input preview"
                  placeholder="Input placeholder"
                />
                <Textarea
                  aria-label="Textarea preview"
                  placeholder="Textarea placeholder"
                />
                <Select defaultValue="one">
                  <SelectTrigger aria-label="Select preview" className="w-full">
                    <SelectValue placeholder="Select placeholder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one">Option one</SelectItem>
                    <SelectItem value="two">Option two</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(value) => setIsChecked(value === true)}
                  />
                  Checkbox preview
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feedback</CardTitle>
                <CardDescription>
                  Badges, dialog, sheet, and toast.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Dialog preview</DialogTitle>
                      <DialogDescription>
                        Keyboard and focus behavior preview.
                      </DialogDescription>
                    </DialogHeader>
                  </DialogContent>
                </Dialog>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost">Open sheet</Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Sheet preview</SheetTitle>
                      <SheetDescription>
                        Responsive slide-over preview.
                      </SheetDescription>
                    </SheetHeader>
                  </SheetContent>
                </Sheet>
                <Button
                  variant="primary"
                  onClick={() => toast.success("Toast preview")}
                >
                  Show toast
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Disclosure</CardTitle>
                <CardDescription>Accordion and tabs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <Accordion type="single" collapsible>
                  <AccordionItem value="one">
                    <AccordionTrigger>Accordion item</AccordionTrigger>
                    <AccordionContent>
                      Accordion content preview.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <Tabs defaultValue="one">
                  <TabsList>
                    <TabsTrigger value="one">Tab one</TabsTrigger>
                    <TabsTrigger value="two">Tab two</TabsTrigger>
                  </TabsList>
                  <TabsContent value="one">
                    Tab one content preview.
                  </TabsContent>
                  <TabsContent value="two">
                    Tab two content preview.
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </section>

        <section aria-labelledby="motion" className="space-y-6">
          <SectionHeading
            id="motion"
            eyebrow="Motion"
            title="Reduced-motion aware wrappers"
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Reveal>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Reveal</CardTitle>
                  <CardDescription>
                    IntersectionObserver with opacity and transform only.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
            <ParallaxImage
              src="/placeholder-farm.svg"
              alt="Abstract farm placeholder"
              className="min-h-64 rounded-xl"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  id,
  title,
}: {
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="font-heading text-forest-900 mt-2 text-3xl sm:text-4xl"
      >
        {title}
      </h2>
    </div>
  );
}
