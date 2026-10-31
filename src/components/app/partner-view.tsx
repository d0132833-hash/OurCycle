'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Heart,
  Sparkles,
  AlertCircle,
  Coffee,
  Utensils,
  Moon,
  ShieldCheck,
  Smile,
  Copy,
  Check,
  MessageCircleHeart,
  Battery,
  Calendar,
  ShoppingCart,
  Compass,
  Info,
  ExternalLink,
  Plus,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DayEntry, Phase } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { fmtShort } from '@/components/app/phase-copy'
import {
  calculateEnergyBattery,
  getMindsetGuidance,
  generateContextualTexts,
  getPhaseDateIdeas,
  getCareGroceryList,
  PARTNER_SIGNALS,
  parseCustomShoppingItems,
  addCustomShoppingTag,
  toggleCustomShoppingTag,
  removeCustomShoppingTag,
  setBatteryOverrideTag,
  type DynamicText,
  type GroceryItem,
} from '@/lib/partner-intelligence'

interface PartnerViewProps {
  prediction: Prediction
  todayEntry: DayEntry | null
  today: string
}

interface PhaseAdvice {
  headline: string
  hormoneSummary: string
  moodEnergy: string
  actionTips: string[]
  thingsToAvoid: string[]
  intimacyAdvice: string
}

const PARTNER_PHASE_GUIDE: Record<Phase, PhaseAdvice> = {
  menstrual: {
    headline: 'Rest & Comfort Phase (Menstruation)',
    hormoneSummary:
      'Estrogen and progesterone are at their lowest baseline levels. The body is shedding energy and resources.',
    moodEnergy: 'Energy is naturally lower. Physical cramps, backaches, or fatigue are common.',
    actionTips: [
      'Offer a warm heating pad or brew hot herbal tea without being asked.',
      'Take initiative with dinners, dishes, and errands so she can rest guilt-free.',
      'Keep evening plans cozy, low-key, and flexible.',
      'A gentle lower back or foot massage works wonders for cramp relief.',
    ],
    thingsToAvoid: [
      'Avoid pressuring her into crowded, high-energy social outings.',
      'Don’t comment on changes in appetite or desire to rest.',
    ],
    intimacyAdvice: 'Prioritize cuddling, emotional closeness, and non-demanding physical comfort.',
  },
  follicular: {
    headline: 'Rising Energy & Creativity (Follicular)',
    hormoneSummary:
      'Estrogen is steadily climbing, boosting brain dopamine, serotonin, and physical stamina.',
    moodEnergy:
      'Mood is lifting, focus is sharp, and optimism is at a peak. Great window for collaboration and dates.',
    actionTips: [
      'Great time to plan fun dates, try new restaurants, or embark on weekend getaways.',
      'Engage in stimulating conversations and brainstorming future goals.',
      'Support her goals and join her in active workouts or outdoor adventures.',
    ],
    thingsToAvoid: [
      'Don’t let the energetic momentum pass without planning something memorable together.',
    ],
    intimacyAdvice: 'Enthusiasm and curiosity are naturally heightened — great time for spontaneity.',
  },
  ovulation: {
    headline: 'Peak Vitality & Connection (Ovulation)',
    hormoneSummary: 'Estrogen and testosterone surge to their monthly peak.',
    moodEnergy: 'Highest natural energy, social confidence, and magnetic charisma.',
    actionTips: [
      'Plan a dressed-up date night or special evening out.',
      'Give sincere compliments — she feels vibrant and will appreciate the connection.',
      'Be fully present and engaged in quality conversation.',
    ],
    thingsToAvoid: [
      'Avoid cancelling plans or being emotionally distant during peak connection days.',
    ],
    intimacyAdvice: 'Libido is typically at its monthly high. Passion and romantic energy peak here.',
  },
  luteal: {
    headline: 'Winding Down & Sensitivity (Luteal / PMS)',
    hormoneSummary:
      'Progesterone rises then plunges before bleeding; serotonin dips can trigger emotional vulnerability.',
    moodEnergy: 'May experience brain fog, bloating, breast tenderness, or emotional sensitivity.',
    actionTips: [
      'Listen with empathy rather than trying to rationally "fix" every feeling.',
      'Stock favorite snacks, dark chocolate, or comfort foods in advance.',
      'Provide extra reassurance and words of affirmation.',
      'Step up around the house to reduce cognitive overwhelm.',
    ],
    thingsToAvoid: [
      'Never ask "Is it that time of the month?" when she expresses frustration.',
      'Avoid starting heavy logistical arguments or critiques right now.',
    ],
    intimacyAdvice:
      'Emotional safety comes first. Be tender, gentle, and follow her lead without pressure.',
  },
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(15)
    } catch {}
  }
}

export function PartnerView({ prediction, todayEntry, today }: PartnerViewProps) {
  const router = useRouter()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeTextCategory, setActiveTextCategory] = useState<string>('all')
  const [checkedGrocery, setCheckedGrocery] = useState<Record<string, boolean>>({})
  const [customItemInput, setCustomItemInput] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isAdjustingBattery, setIsAdjustingBattery] = useState(false)
  const [draftBattery, setDraftBattery] = useState(50)
  const [isSavingBattery, setIsSavingBattery] = useState(false)

  const currentTags = todayEntry?.tags ?? []
  const [localTags, setLocalTags] = useState<string[]>(currentTags)

  useEffect(() => {
    setLocalTags(todayEntry?.tags ?? [])
  }, [todayEntry?.tags])

  const customItems = useMemo(() => parseCustomShoppingItems(localTags), [localTags])

  const activeEntry = useMemo(() => {
    return todayEntry
      ? { ...todayEntry, tags: localTags }
      : ({ date: today, tags: localTags } as DayEntry)
  }, [todayEntry, localTags, today])

  const phase: Phase = prediction.todayPhase || 'follicular'
  const guide = PARTNER_PHASE_GUIDE[phase]

  // Calculate energy & battery
  const battery = useMemo(
    () => calculateEnergyBattery(phase, activeEntry),
    [phase, activeEntry],
  )

  // Mindset guidance & golden rule
  const mindset = useMemo(
    () => getMindsetGuidance(phase, todayEntry),
    [phase, todayEntry],
  )

  // Contextual messages
  const contextualTexts = useMemo(
    () => generateContextualTexts(phase, todayEntry),
    [phase, todayEntry],
  )

  // Filtered contextual messages
  const filteredTexts = useMemo(() => {
    if (activeTextCategory === 'all') return contextualTexts
    return contextualTexts.filter((t) => t.category === activeTextCategory)
  }, [contextualTexts, activeTextCategory])

  // Date ideas
  const dateIdeas = useMemo(() => getPhaseDateIdeas(phase), [phase])

  // Care grocery list
  const groceryItems = useMemo(
    () => getCareGroceryList(phase, todayEntry),
    [phase, todayEntry],
  )

  // Detect active signals from her
  const activeSignals = PARTNER_SIGNALS.filter((s) => localTags.includes(s.key))

  // Detect active symptoms logged today
  const activeSymptoms: { name: string; level: number; tip: string }[] = []
  if (todayEntry) {
    if (todayEntry.cramps && todayEntry.cramps > 0) {
      activeSymptoms.push({
        name: 'Cramps',
        level: todayEntry.cramps,
        tip: 'Bring a warm heating pad, prepare warm peppermint/chamomile tea, or offer a gentle lower back rub.',
      })
    }
    if (todayEntry.headache && todayEntry.headache > 0) {
      activeSymptoms.push({
        name: 'Headache',
        level: todayEntry.headache,
        tip: 'Dim bright overhead lights, offer a tall glass of cold water with electrolytes, and keep noise down.',
      })
    }
    if (todayEntry.fatigue && todayEntry.fatigue > 0) {
      activeSymptoms.push({
        name: 'Fatigue',
        level: todayEntry.fatigue,
        tip: 'Handle evening chores completely so she can take an early warm shower and sleep undisturbed.',
      })
    }
    if (todayEntry.bloating && todayEntry.bloating > 0) {
      activeSymptoms.push({
        name: 'Bloating',
        level: todayEntry.bloating,
        tip: 'Avoid salty or heavy meals; suggest comforting light soups or a digestive ginger tea.',
      })
    }
    if (todayEntry.breast_tenderness && todayEntry.breast_tenderness > 0) {
      activeSymptoms.push({
        name: 'Breast tenderness',
        level: todayEntry.breast_tenderness,
        tip: 'Be extra gentle with tight hugs and physical touch today.',
      })
    }
    if (todayEntry.back_pain && todayEntry.back_pain > 0) {
      activeSymptoms.push({
        name: 'Back pain',
        level: todayEntry.back_pain,
        tip: 'Place a lumbar pillow behind her when seated, or massage the sacrum area with soothing circular pressure.',
      })
    }
  }

  // Copy helper
  const handleCopyText = async (text: string, id: string) => {
    triggerHaptic()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast.success('Copied text to clipboard!')
      setTimeout(() => setCopiedId(null), 2500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  // Toggle built-in grocery item
  const toggleGrocery = (id: string) => {
    triggerHaptic()
    setCheckedGrocery((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Add custom shopping item
  const handleAddCustomItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = customItemInput.trim()
    if (!trimmed) return
    if (trimmed.length > 80) {
      toast.error('Item name must be 80 characters or fewer')
      return
    }
    setIsAddingItem(true)
    triggerHaptic()
    const newTags = addCustomShoppingTag(localTags, trimmed)
    setLocalTags(newTags)
    setCustomItemInput('')

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })
      if (!res.ok) throw new Error('Could not add item')
      toast.success(`Added "${trimmed}" to checklist 💕`)
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to add item to checklist')
    } finally {
      setIsAddingItem(false)
    }
  }

  // Toggle custom shopping item
  const handleToggleCustomItem = async (tag: string) => {
    triggerHaptic()
    const newTags = toggleCustomShoppingTag(localTags, tag)
    setLocalTags(newTags)

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })
      if (!res.ok) throw new Error('Could not toggle item')
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to update item state')
    }
  }

  // Remove custom shopping item
  const handleRemoveCustomItem = async (tag: string, name: string) => {
    triggerHaptic()
    const newTags = removeCustomShoppingTag(localTags, tag)
    setLocalTags(newTags)

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })
      if (!res.ok) throw new Error('Could not remove item')
      toast.info(`Removed "${name}" from checklist`)
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to remove item')
    }
  }

  // Save manual social battery adjustment
  const handleSaveBattery = async () => {
    setIsSavingBattery(true)
    triggerHaptic()
    const newTags = setBatteryOverrideTag(localTags, draftBattery)
    setLocalTags(newTags)
    setIsAdjustingBattery(false)

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })
      if (!res.ok) throw new Error('Could not save battery adjustment')
      toast.success(`Social battery adjusted to ${draftBattery}% 💕`)
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to save social battery adjustment')
    } finally {
      setIsSavingBattery(false)
    }
  }

  // Reset social battery back to automated estimate
  const handleResetBattery = async () => {
    setIsSavingBattery(true)
    triggerHaptic()
    const newTags = setBatteryOverrideTag(localTags, null)
    setLocalTags(newTags)
    setIsAdjustingBattery(false)

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })
      if (!res.ok) throw new Error('Could not reset battery')
      toast.success('Reset social battery to automated estimate')
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to reset social battery')
    } finally {
      setIsSavingBattery(false)
    }
  }

  // Copy remaining shopping items (both custom and curated)
  const handleCopyGroceryList = async () => {
    triggerHaptic()
    const remainingCustom = customItems.filter((item) => !item.isDone)
    const remainingBuiltIn = groceryItems.filter((item) => !checkedGrocery[item.id])

    if (remainingCustom.length === 0 && remainingBuiltIn.length === 0) {
      toast.info('All items checked off!')
      return
    }

    const sections: string[] = []
    if (remainingCustom.length > 0) {
      sections.push(
        `🌟 Special Requests from Her:\n` +
          remainingCustom.map((i) => `• ${i.name} (Her Wish 💕)`).join('\n'),
      )
    }
    if (remainingBuiltIn.length > 0) {
      sections.push(
        `🛒 Curated Comfort Essentials (${guide.headline}):\n` +
          remainingBuiltIn.map((i) => `• ${i.name} (${i.reason})`).join('\n'),
      )
    }

    const fullText = sections.join('\n\n')
    try {
      await navigator.clipboard.writeText(fullText)
      toast.success('Copied shopping list to clipboard!')
    } catch {
      toast.error('Could not copy list')
    }
  }

  return (
    <div className="space-y-4 pt-1">
      {/* Top Hero Banner & Social Battery (Grid on tablet/laptop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Top Hero Banner */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-rose-50/50 to-amber-50/40 p-4.5 dark:from-primary/15 dark:via-zinc-900/60 dark:to-zinc-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wide uppercase">
                <Heart className="h-4 w-4 fill-primary" />
                <span>Partner Care Companion</span>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                {mindset.mode}
              </span>
            </div>

            <h3 className="font-display mt-2 text-lg md:text-xl font-bold text-foreground">
              {guide.headline}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {guide.hormoneSummary}
            </p>
          </div>

          {prediction.nextPeriodStart && (
            <div className="mt-3.5 flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 bg-white/70 dark:bg-zinc-800/70 rounded-xl px-3 py-1.5 w-fit border border-border/40">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">Forecast:</span>
              <span>Next period expected ~{fmtShort(prediction.nextPeriodStart)}</span>
            </div>
          )}
        </div>

        {/* Social Battery & Capacity Gauge */}
        <div className="card-soft p-5 space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Battery
                  className={`h-4 w-4 ${battery.isManual ? 'text-rose-500' : 'text-emerald-500'}`}
                />
                <span>
                  {battery.isManual ? 'Her Adjusted Social Battery' : 'Estimated Energy & Social Battery'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {battery.isManual && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5 fill-rose-500" />
                    <span>Adjusted by Her</span>
                  </span>
                )}
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${battery.badgeColor}`}
                >
                  {battery.label} · {battery.percentage}%
                </span>
              </div>
            </div>

            {/* Battery Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-zinc-800">
              <div
                className={`h-full transition-all duration-500 rounded-full ${battery.barColor}`}
                style={{ width: `${battery.percentage}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {battery.summary}
          </p>

          {/* Inline Battery Adjustment for Her */}
          <div className="pt-2 border-t border-border/40">
            {!isAdjustingBattery ? (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic()
                    setDraftBattery(battery.percentage)
                    setIsAdjustingBattery(true)
                  }}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>
                    {battery.isManual ? 'Modify battery level' : 'Estimate inaccurate? Adjust battery'}
                  </span>
                </button>
                {battery.isManual && (
                  <button
                    type="button"
                    onClick={handleResetBattery}
                    disabled={isSavingBattery}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset auto
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <span>Adjust Her Real-Time Social Battery</span>
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Slide or tap a preset to set how she actually feels today
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary px-2 py-0.5 rounded-lg bg-primary/10">
                    {draftBattery}%
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={draftBattery}
                  onChange={(e) => setDraftBattery(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-stone-100 dark:bg-zinc-800 rounded-lg cursor-pointer"
                />

                {/* 5 Quick Presets */}
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { label: 'Very Low', pct: 15 },
                    { label: 'Low', pct: 30 },
                    { label: 'Moderate', pct: 55 },
                    { label: 'High', pct: 75 },
                    { label: 'Peak', pct: 95 },
                  ].map((p) => (
                    <button
                      key={p.pct}
                      type="button"
                      onClick={() => {
                        triggerHaptic()
                        setDraftBattery(p.pct)
                      }}
                      className={`py-1 px-1 rounded-lg text-[10px] font-medium transition-all ${
                        draftBattery === p.pct
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-stone-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdjustingBattery(false)}
                    className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    Cancel
                  </button>
                  {battery.isManual && (
                    <button
                      type="button"
                      onClick={handleResetBattery}
                      disabled={isSavingBattery}
                      className="px-2.5 py-1 text-xs text-stone-600 dark:text-stone-300 hover:text-rose-500 rounded-lg"
                    >
                      Reset auto
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveBattery}
                    disabled={isSavingBattery}
                    className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <Check className="h-3 w-3" />
                    <span>Save {draftBattery}%</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mindset & Communication Golden Rule */}
      <div className="card-soft p-5 border-l-4 border-l-primary space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Compass className="h-4 w-4" />
            <span>{mindset.badgeText}</span>
          </div>
        </div>
        <h4 className="text-sm md:text-base font-semibold text-foreground">{mindset.headline}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {mindset.description}
        </p>
        <div className="bg-primary/10 rounded-xl p-2.5 text-xs text-foreground font-medium flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-primary font-semibold">Golden Rule: </strong>
            {mindset.goldenRule}
          </span>
        </div>
      </div>

      {/* Active Wish / SOS from Her & Active Symptoms */}
      {(activeSignals.length > 0 || activeSymptoms.length > 0) && (
        <div className={`grid grid-cols-1 ${activeSignals.length > 0 && activeSymptoms.length > 0 ? 'md:grid-cols-2' : ''} gap-4`}>
          {activeSignals.length > 0 && (
            <div className="card-soft p-4.5 border-l-4 border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-xs tracking-wide uppercase">
                  <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                  <span>Her Active Wish Right Now</span>
                </div>
                <span className="text-[10px] bg-rose-500 text-white font-semibold px-2 py-0.5 rounded-full">
                  Requested Today
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {activeSignals.map((sig) => (
                  <div
                    key={sig.key}
                    className="text-xs bg-white/80 dark:bg-zinc-800/80 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm"
                  >
                    <div className="flex items-center justify-between font-semibold text-foreground text-sm">
                      <span>{sig.label}</span>
                    </div>
                    <p className="mt-1 text-stone-600 dark:text-stone-300 text-xs leading-normal">
                      {sig.tip}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleCopyText(
                            `On it right now! ${sig.label} coming up 💕`,
                            `sig-${sig.key}`,
                          )
                        }
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[11px] font-medium hover:bg-rose-600 transition-colors"
                      >
                        {copiedId === `sig-${sig.key}` ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <MessageCircleHeart className="h-3.5 w-3.5" />
                        )}
                        <span>Send &ldquo;On it right now! 💕&rdquo;</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSymptoms.length > 0 && (
            <div className="card-soft p-4.5 border-l-4 border-l-amber-500">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs tracking-wide uppercase">
                <AlertCircle className="h-4 w-4" />
                <span>She Logged Symptoms Today</span>
              </div>
              <div className="mt-3 space-y-2.5">
                {activeSymptoms.map((s, i) => (
                  <div
                    key={i}
                    className="text-xs bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40"
                  >
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>{s.name}</span>
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        Intensity {s.level}/3
                      </span>
                    </div>
                    <p className="mt-1 text-stone-600 dark:text-stone-300 leading-normal">
                      {s.tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* "It's Not About You" De-escalation Box (Luteal / PMS / Low Mood) */}
      {(phase === 'luteal' ||
        (todayEntry?.mood && todayEntry.mood <= 2) ||
        (todayEntry?.fatigue && todayEntry.fatigue >= 2)) && (
        <div className="card-soft p-4 bg-stone-50/80 dark:bg-zinc-800/40 border border-border/80 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            <span>Biological Context: &ldquo;It&apos;s Not About You&rdquo;</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            During this phase, rapid hormone fluctuations drop serotonin and dopamine in the
            brain. Sensory fatigue, irritability, or low stamina are biological reactions, not a
            reflection of her feelings toward you.
          </p>
          <ul className="text-xs text-stone-700 dark:text-stone-300 space-y-1.5 pt-1">
            <li className="flex items-start gap-1.5">
              <span className="text-primary font-bold">•</span>
              <span>
                <strong>Hold space:</strong> If she seems quiet or overwhelmed, offer comfort
                without interrogating why.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-primary font-bold">•</span>
              <span>
                <strong>Zero debates:</strong> Save tricky financial or relationship critiques
                for the follicular phase.
              </span>
            </li>
          </ul>
        </div>
      )}

      {/* Caring Texts & Grocery Checklist (2-Column on Laptop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Dynamic Caring Text Generator */}
        <div className="card-soft p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircleHeart className="h-4 w-4 text-rose-500" />
              <h4>Send a Context-Aware Caring Check-in</h4>
            </div>
            <span className="text-[11px] text-muted-foreground">1-tap copy &amp; send</span>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'comfort', label: 'Pain & Comfort' },
              { id: 'food_chores', label: 'Food & Chores' },
              { id: 'affirmation', label: 'Love & Affirmation' },
              { id: 'fun', label: 'Fun & Dates' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveTextCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  activeTextCategory === cat.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-stone-100 dark:bg-zinc-800 text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Message Cards */}
          <div className="space-y-2 pt-1 max-h-[460px] overflow-y-auto pr-1 nice-scroll">
            {filteredTexts.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-stone-50/70 dark:bg-zinc-800/60 border border-border/70 text-xs space-y-2 group hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-primary">
                    {item.categoryLabel}
                  </span>
                  <span>{item.contextReason}</span>
                </div>
                <p className="text-foreground leading-relaxed">&ldquo;{item.text}&rdquo;</p>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                  {/* 1-tap SMS link */}
                  <a
                    href={`sms:?&body=${encodeURIComponent(item.text)}`}
                    className="flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-300 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-700"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>SMS</span>
                  </a>
                  {/* 1-tap WhatsApp link */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(item.text)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-medium text-stone-600 dark:text-stone-300 hover:text-emerald-500 transition-colors px-2 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-700"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>WhatsApp</span>
                  </a>
                  {/* Copy to clipboard */}
                  <button
                    onClick={() => handleCopyText(item.text, item.id)}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors px-2.5 py-1 rounded-lg bg-primary/10"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Care Grocery & Comfort Shopping Checklist */}
        <div className="card-soft p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h4>Care &amp; Comfort Shopping Checklist</h4>
            </div>
            <button
              onClick={handleCopyGroceryList}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Copy className="h-3 w-3" />
              <span>Copy List</span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Stock treats and comfort essentials tailored to her phase, or add custom requests:
          </p>

          {/* Quick Add Custom Item Form */}
          <form onSubmit={handleAddCustomItem} className="flex gap-1.5 pt-0.5">
            <input
              type="text"
              value={customItemInput}
              onChange={(e) => setCustomItemInput(e.target.value)}
              placeholder="Add comfort treat (e.g. Gelato, heating patch)..."
              maxLength={80}
              className="flex-1 text-xs px-3 py-2 rounded-xl border border-border/80 bg-stone-50/70 dark:bg-zinc-800/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={isAddingItem || !customItemInput.trim()}
              className="px-3 py-2 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-2 pt-1 max-h-[460px] overflow-y-auto pr-1 nice-scroll">
            {/* Custom items added by her / partner */}
            {customItems.length > 0 && (
              <div className="space-y-1.5 pb-2 border-b border-border/50">
                <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider uppercase text-primary px-0.5">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3 fill-primary" />
                    <span>Requested by Her ({customItems.length})</span>
                  </span>
                </div>
                {customItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-start justify-between gap-2.5 p-2.5 rounded-xl border transition-all text-xs ${
                      item.isDone
                        ? 'border-border/40 bg-stone-100/50 dark:bg-zinc-900/30 opacity-60'
                        : 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                    }`}
                  >
                    <div
                      onClick={() => handleToggleCustomItem(item.tag)}
                      className="flex items-start gap-2.5 flex-1 cursor-pointer"
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          item.isDone
                            ? 'bg-primary border-primary text-white'
                            : 'border-stone-300 dark:border-zinc-600'
                        }`}
                      >
                        {item.isDone && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1">
                        <div
                          className={`flex items-center gap-1.5 font-medium ${
                            item.isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          <span>{item.name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500 text-white">
                            Her Wish 💕
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {item.isDone ? 'Checked off ✓' : 'Direct request from her today'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomItem(item.tag, item.name)}
                      className="text-muted-foreground hover:text-rose-500 transition-colors p-1"
                      title="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Curated biological essentials */}
            <div className="space-y-1.5">
              {customItems.length > 0 && (
                <div className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground px-0.5 pt-1">
                  <span>Curated Phase Essentials</span>
                </div>
              )}
              {groceryItems.map((item) => {
                const isChecked = Boolean(checkedGrocery[item.id])
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleGrocery(item.id)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                      isChecked
                        ? 'border-border/40 bg-stone-100/50 dark:bg-zinc-900/30 opacity-60 line-through'
                        : item.isUrgent
                          ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                          : 'border-border/70 bg-stone-50/50 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isChecked
                          ? 'bg-primary border-primary text-white'
                          : 'border-stone-300 dark:border-zinc-600'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <span>{item.name}</span>
                        {item.isUrgent && !isChecked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500 text-white">
                            Relief
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Phase-Synced Date Night & Activity Matchmaker */}
      <div className="card-soft p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h4>Phase-Synced Date &amp; Connection Matchmaker</h4>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">Curated for today</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Activities matched to her current physical stamina and hormonal strengths:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {dateIdeas.map((idea) => (
            <div
              key={idea.id}
              className="p-3.5 rounded-xl border border-border/70 bg-stone-50/50 dark:bg-zinc-800/40 space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-xs text-foreground">{idea.title}</h5>
                  <button
                    onClick={() => handleCopyText(idea.sampleInvite, idea.id)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    {copiedId === idea.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                  {idea.description}
                </p>
              </div>
              <div className="mt-2 rounded-lg bg-white/70 dark:bg-zinc-800/70 p-2 text-[11px] text-stone-600 dark:text-stone-400">
                <strong className="text-foreground font-medium">Why it works: </strong>
                {idea.whyItWorks}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intimacy & Touch Compass + Mindful Boundaries (2-Column on Tablet/Laptop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Intimacy & Touch Compass */}
        <div className="card-soft p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Smile className="h-4 w-4 text-primary" />
            <h4>Intimacy &amp; Physical Touch Compass</h4>
          </div>
          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
            {guide.intimacyAdvice}
          </p>
        </div>

        {/* What to Avoid & Mindful Boundaries */}
        <div className="card-soft p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h4>What to Be Mindful Of</h4>
          </div>
          <ul className="space-y-2 pt-1">
            {guide.thingsToAvoid.map((avoid, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
              >
                <span className="text-primary font-bold">•</span>
                <span>{avoid}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Discreet Personal Calendar Sync */}
      <div className="card-soft p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <h4>Sync Discreetly to Your Phone Calendar</h4>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Export an `.ics` calendar file with discreet phase reminders (e.g., &ldquo;[Cycle]
          Rest & Comfort Window&rdquo;) for Google Calendar, Apple Calendar, or Outlook.
          Completely private and discreet.
        </p>
        <div className="pt-1">
          <a
            href="/api/partner/calendar"
            download="ourcycle-partner-companion.ics"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Download Calendar (.ics)</span>
          </a>
        </div>
      </div>
    </div>
  )
}
