// ============================================================================
// Our Cycle — Partner Intelligence Engine
// Pure TypeScript logic for calculating partner empathy metrics,
// social battery estimates, dynamic contextual messages, grocery lists,
// phase date matchmakers, and discreet calendar sync.
// ============================================================================

import type { DayEntry, Phase } from './types'
import type { Prediction } from './predictions'
import { addDays } from './dates'

export interface BatteryScore {
  percentage: number
  label: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Peak'
  badgeColor: string
  barColor: string
  summary: string
  isManual?: boolean
}

export interface MindsetGuidance {
  mode: 'Hold Space' | 'Tender Care' | 'Active Teamwork' | 'Peak Connection'
  badgeText: string
  headline: string
  description: string
  goldenRule: string
}

export interface PartnerSignalDef {
  key: string
  label: string
  icon: 'tea' | 'dinner' | 'quiet' | 'hug' | 'snack' | 'massage'
  tip: string
}

export const PARTNER_SIGNALS: PartnerSignalDef[] = [
  {
    key: 'need:tea',
    label: 'Warm tea & heating pad',
    icon: 'tea',
    tip: 'Bring a fresh mug of chamomile or peppermint tea and a warm heating pad.',
  },
  {
    key: 'need:dinner',
    label: 'Handle dinner tonight',
    icon: 'dinner',
    tip: 'Take dinner 100% off her plate: order her favorite comfort food or cook without asking.',
  },
  {
    key: 'need:quiet',
    label: 'Quiet alone time',
    icon: 'quiet',
    tip: 'Give her peaceful, uninterrupted space to decompress with zero demands.',
  },
  {
    key: 'need:hug',
    label: 'Warm hug (no words needed)',
    icon: 'hug',
    tip: 'Offer a long, comforting, silent embrace. No advice, just physical reassurance.',
  },
  {
    key: 'need:snack',
    label: 'Comfort snack run',
    icon: 'snack',
    tip: 'Surprise her with dark chocolate, salted snacks, or her favorite ice cream.',
  },
  {
    key: 'need:massage',
    label: 'Back or foot rub',
    icon: 'massage',
    tip: 'Offer gentle circular pressure on the sacrum/lower back or soothing foot massage.',
  },
]

export interface DynamicText {
  id: string
  category: 'comfort' | 'food_chores' | 'affirmation' | 'fun'
  categoryLabel: string
  text: string
  contextReason: string
}

export interface DateIdea {
  id: string
  title: string
  description: string
  whyItWorks: string
  sampleInvite: string
}

export interface GroceryItem {
  id: string
  category: 'Drinks & Teas' | 'Snacks & Cravings' | 'Physical Comfort' | 'Relief & Care'
  name: string
  reason: string
  isUrgent?: boolean
}

/**
 * Resolves a BatteryScore structure given a numeric score.
 */
export function getBatteryScoreForPercentage(
  score: number,
  isManual: boolean = false,
): BatteryScore {
  const clamped = Math.max(10, Math.min(100, Math.round(score)))

  if (clamped >= 85) {
    return {
      percentage: clamped,
      label: 'Peak',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      barColor: 'bg-emerald-500',
      summary: isManual
        ? 'Self-reported peak vitality: Feeling vibrant, energetic, and excited for connection!'
        : 'High vitality, magnetic focus, and enthusiastic social battery.',
      isManual,
    }
  }
  if (clamped >= 70) {
    return {
      percentage: clamped,
      label: 'High',
      badgeColor: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
      barColor: 'bg-teal-500',
      summary: isManual
        ? 'Self-reported high battery: Feeling good with steady stamina for activities and plans.'
        : 'Good steady stamina. Receptive to active plans and collaborative tasks.',
      isManual,
    }
  }
  if (clamped >= 45) {
    return {
      percentage: clamped,
      label: 'Moderate',
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      barColor: 'bg-amber-500',
      summary: isManual
        ? 'Self-reported moderate battery: Prefers relaxed pacing, cozy settings, and low pressure.'
        : 'Moderate battery. Prefers calm pacing, familiar environments, and low stress.',
      isManual,
    }
  }
  if (clamped >= 25) {
    return {
      percentage: clamped,
      label: 'Low',
      badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
      barColor: 'bg-rose-500',
      summary: isManual
        ? 'Self-reported low battery: Reserves running low. Needs tender care, calm space, and zero demands.'
        : 'Running low on reserves. Cognitive fatigue and physical sensitivity are likely.',
      isManual,
    }
  }
  return {
    percentage: clamped,
    label: 'Very Low',
    badgeColor: 'bg-rose-600/20 text-rose-800 dark:text-rose-200',
    barColor: 'bg-rose-600',
    summary: isManual
      ? 'Self-reported very low battery: Full recharge required. Gentle silence, warmth, and zero demands.'
      : 'Rest mode critical. Zero pressure, minimal questions, deep somatic comfort.',
    isManual,
  }
}

/**
 * Extracts a manual social battery percentage adjustment from day tags if set.
 * Tag format: 'battery:override:<10..100>'
 */
export function extractBatteryOverride(tags?: string[] | null): number | null {
  if (!tags || !Array.isArray(tags)) return null
  const tag = tags.find((t) => t.startsWith('battery:override:'))
  if (!tag) return null
  const val = parseInt(tag.replace('battery:override:', ''), 10)
  return isNaN(val) ? null : Math.max(10, Math.min(100, val))
}

/**
 * Sets or removes a manual social battery override tag.
 */
export function setBatteryOverrideTag(
  currentTags: string[] | null | undefined,
  percentage: number | null,
): string[] {
  const filtered = (currentTags ?? []).filter((t) => !t.startsWith('battery:override:'))
  if (percentage === null) return filtered
  const clamped = Math.max(10, Math.min(100, Math.round(percentage)))
  return [...filtered, `battery:override:${clamped}`]
}

/**
 * Calculates her estimated daily energy/social battery based on phase and logged day data.
 * If manually adjusted by her, honors the self-reported percentage.
 */
export function calculateEnergyBattery(
  phase: Phase | null,
  entry: DayEntry | null,
): BatteryScore {
  // Check for manual override set by her in the partners tab
  const override = extractBatteryOverride(entry?.tags)
  if (override !== null) {
    return getBatteryScoreForPercentage(override, true)
  }

  // Baseline energy by cycle phase
  let base: number
  switch (phase) {
    case 'ovulation':
      base = 92
      break
    case 'follicular':
      base = 82
      break
    case 'luteal':
      base = 48
      break
    case 'menstrual':
      base = 34
      break
    default:
      base = 65
  }

  // Adjust for explicitly logged energy (scale 1..5, neutral is 3)
  if (entry?.energy) {
    const delta = (entry.energy - 3) * 14
    base += delta
  }

  // Adjust for logged sleep
  if (typeof entry?.sleep_hours === 'number') {
    if (entry.sleep_hours < 6) base -= 12
    else if (entry.sleep_hours >= 8) base += 8
  }

  // Penalize for active symptoms
  const symptomDeductions = [
    { val: entry?.cramps, mult: 7 },
    { val: entry?.fatigue, mult: 8 },
    { val: entry?.headache, mult: 6 },
    { val: entry?.back_pain, mult: 5 },
    { val: entry?.bloating, mult: 3 },
  ]

  for (const s of symptomDeductions) {
    if (s.val && s.val > 0) {
      base -= s.val * s.mult
    }
  }

  return getBatteryScoreForPercentage(base, false)
}

/**
 * Returns partner communication mode and golden rule.
 */
export function getMindsetGuidance(
  phase: Phase | null,
  entry: DayEntry | null,
): MindsetGuidance {
  const hasCramps = (entry?.cramps ?? 0) >= 2
  const hasFatigue = (entry?.fatigue ?? 0) >= 2
  const lowMood = (entry?.mood ?? 3) <= 2

  if (phase === 'menstrual' || hasCramps) {
    return {
      mode: 'Tender Care',
      badgeText: 'Rest & Relief Priority',
      headline: 'Support Her Recovery Body & Soul',
      description:
        'Hormones are at baseline; the body is physically working hard. Keep the environment warm, soft, and soothing.',
      goldenRule: 'Take initiative with physical comfort (heat, blankets, tea) without asking first.',
    }
  }

  if (phase === 'luteal' || lowMood || hasFatigue) {
    return {
      mode: 'Hold Space',
      badgeText: 'Empathy & Validation Priority',
      headline: 'Emotional Grounding & Zero Pressure',
      description:
        'Progesterone shifts and serotonin dips can trigger sensory overload or emotional vulnerability.',
      goldenRule: 'Validate and listen. Never debate logic or ask "Is it that time of the month?".',
    }
  }

  if (phase === 'ovulation') {
    return {
      mode: 'Peak Connection',
      badgeText: 'Romance & Spontaneity',
      headline: 'Vibrant Chemistry & Quality Time',
      description:
        'Estrogen and testosterone are at their peak. High charisma, passion, and enthusiasm.',
      goldenRule: 'Show up with undivided attention, genuine compliments, and exciting connection.',
    }
  }

  return {
    mode: 'Active Teamwork',
    badgeText: 'Growth & Future Planning',
    headline: 'Creative Energy & Fresh Momentum',
    description:
      'Estrogen is climbing steadily. Optimism, focus, and curiosity make this great for teamwork.',
    goldenRule: 'Support her ideas, plan future getaways, and be an encouraging partner.',
  }
}

/**
 * Dynamically builds context-tailored caring messages he can copy or send in 1 tap.
 */
export function generateContextualTexts(
  phase: Phase | null,
  entry: DayEntry | null,
): DynamicText[] {
  const texts: DynamicText[] = []

  const cramps = entry?.cramps ?? 0
  const fatigue = entry?.fatigue ?? 0
  const headache = entry?.headache ?? 0
  const mood = entry?.mood ?? 3

  // Cramp / Pain specific
  if (cramps > 0) {
    texts.push({
      id: 'cramps-1',
      category: 'comfort',
      categoryLabel: 'Pain Relief',
      text: "Thinking of you 💕 How are the cramps feeling? Heating pad and hot tea are ready whenever you want.",
      contextReason: 'Logged cramps today',
    })
    texts.push({
      id: 'cramps-2',
      category: 'food_chores',
      categoryLabel: 'Care & Comfort',
      text: "Please take it completely easy today. I'm handling dinner and all the chores so you can just curl up and rest.",
      contextReason: 'Cramp relief support',
    })
  }

  // Fatigue specific
  if (fatigue > 0 || (entry?.sleep_hours && entry.sleep_hours < 7)) {
    texts.push({
      id: 'fatigue-1',
      category: 'food_chores',
      categoryLabel: 'Rest Mode',
      text: "Hey love, don't worry about lifting a finger tonight. Crawl straight into bed when you're ready—I've got everything covered.",
      contextReason: 'Logged fatigue / low energy',
    })
  }

  // Headache specific
  if (headache > 0) {
    texts.push({
      id: 'headache-1',
      category: 'comfort',
      categoryLabel: 'Soothing',
      text: "Sending gentle love. I'll make sure the house is dark and quiet for you tonight. Let me know if you need cold compresses or water.",
      contextReason: 'Logged headache today',
    })
  }

  // Phase-based texts
  if (phase === 'menstrual') {
    texts.push({
      id: 'menstrual-affirmation',
      category: 'affirmation',
      categoryLabel: 'Affirmation',
      text: "Just wanted to remind you how much I adore you. Be super gentle with yourself today 💕",
      contextReason: 'Menstrual rest phase',
    })
    texts.push({
      id: 'menstrual-comfort',
      category: 'comfort',
      categoryLabel: 'Pamper',
      text: "Can I grab any comfort treats, chocolate, or hot drinks on my way home for you?",
      contextReason: 'Comfort treats offer',
    })
  } else if (phase === 'luteal') {
    texts.push({
      id: 'luteal-pms-care',
      category: 'affirmation',
      categoryLabel: 'Emotional Safety',
      text: "Thinking of you today. No matter what comes up, I'm in your corner and I love you tons 💕",
      contextReason: 'Luteal phase reassurance',
    })
    texts.push({
      id: 'luteal-dinner',
      category: 'food_chores',
      categoryLabel: 'Dinner Relief',
      text: "Craving anything specific for dinner tonight? Tell me what sounds comforting and I'll make it happen!",
      contextReason: 'Zero decision-fatigue dinner',
    })
  } else if (phase === 'ovulation') {
    texts.push({
      id: 'ovulation-date',
      category: 'fun',
      categoryLabel: 'Date Invite',
      text: "You looked gorgeous this morning! Let's get dressed up and do something fun together tonight ✨",
      contextReason: 'Ovulatory peak vitality',
    })
    texts.push({
      id: 'ovulation-love',
      category: 'affirmation',
      categoryLabel: 'Romance',
      text: "Just counting down the hours until I get to see you again today 😘",
      contextReason: 'Connection & romance',
    })
  } else {
    // Follicular
    texts.push({
      id: 'follicular-spark',
      category: 'fun',
      categoryLabel: 'Spontaneous',
      text: "Hope your day is treating you well! Want to try that new spot or take a nice walk together this evening?",
      contextReason: 'Rising follicular energy',
    })
    texts.push({
      id: 'follicular-cheer',
      category: 'affirmation',
      categoryLabel: 'Cheer',
      text: "Hope your day goes smoothly, rockstar! Rooting for you today 💕",
      contextReason: 'Mid-day motivation',
    })
  }

  // Always offer a general sweet check-in if list is short
  if (texts.length < 3) {
    texts.push({
      id: 'general-checkin',
      category: 'affirmation',
      categoryLabel: 'Check-in',
      text: "Just checking in on you 💕 Hope work is going easy. Can't wait to wrap my arms around you later.",
      contextReason: 'Daily affectionate check-in',
    })
  }

  return texts
}

/**
 * Curates date and bonding ideas matched to her biological rhythm.
 */
export function getPhaseDateIdeas(phase: Phase | null): DateIdea[] {
  switch (phase) {
    case 'menstrual':
      return [
        {
          id: 'date-m-1',
          title: 'Cozy Blanket & Movie Sanctuary',
          description: 'Dim lights, pillow fort on the couch, and her favorite comfort comfort movie or comfort series.',
          whyItWorks: 'Zero performance pressure; allows rest while feeling emotionally connected and held.',
          sampleInvite: "Tonight let's build a cozy couch sanctuary with warm blankets and watch whatever you want!",
        },
        {
          id: 'date-m-2',
          title: 'Sacrum & Foot Spa Night',
          description: 'Warm foot soak with lavender salts, followed by a soothing foot and lower-back massage.',
          whyItWorks: 'Relieves pelvic congestion and cramp discomfort through targeted somatic relaxation.',
          sampleInvite: "I want to treat you to a warm foot soak and back rub tonight after dinner 💕",
        },
        {
          id: 'date-m-3',
          title: 'Quiet Bookstore & Warm Drinks',
          description: 'Slow wander through a quiet local bookshop, sipping warm tea or hot cocoa together.',
          whyItWorks: 'Low sensory stimulation, unhurried pacing, gentle quiet companionship.',
          sampleInvite: "Want to grab a warm tea and wander through the bookstore quietly this evening?",
        },
      ]
    case 'follicular':
      return [
        {
          id: 'date-f-1',
          title: 'Explore a New Cuisine or Bistro',
          description: 'Book a table at a lively new neighborhood eatery or cuisine neither of you has tried.',
          whyItWorks: 'Rising estrogen enhances sensory curiosity, dopamine receptivity, and novelty-seeking.',
          sampleInvite: "I found this really cool new restaurant—let's go try it out together tonight!",
        },
        {
          id: 'date-f-2',
          title: 'Sunset Walk or Easy Trail Hike',
          description: 'Scenic outdoor walk in the fresh air, enjoying nature and active conversation.',
          whyItWorks: 'Natural physical stamina is climbing; outdoor movement boosts mood and bonding.',
          sampleInvite: "The weather is lovely—want to catch the sunset on a scenic stroll tonight?",
        },
        {
          id: 'date-f-3',
          title: 'Playful Cooking Challenge at Home',
          description: 'Pick an exciting recipe, put on music, and cook a delicious fresh meal together.',
          whyItWorks: 'Collaborative teamwork feels rewarding and playful during this creative window.',
          sampleInvite: "Let's put on some good tunes and whip up that homemade pasta recipe tonight!",
        },
      ]
    case 'ovulation':
      return [
        {
          id: 'date-o-1',
          title: 'Dressed-Up Romantic Evening',
          description: 'Get dressed to the nines, reservations at a stylish spot, and toast to each other.',
          whyItWorks: 'Peak confidence, charisma, and romantic chemistry make dressed-up dates electric.',
          sampleInvite: "Let's get dressed up tonight and go somewhere special. You deserve a night out ✨",
        },
        {
          id: 'date-o-2',
          title: 'Live Music, Speakeasy or Dancing',
          description: 'Catch an intimate live jazz set, comedy show, or cozy cocktail lounge.',
          whyItWorks: 'Social battery and sensory vitality are at their monthly zenith.',
          sampleInvite: "I found an awesome live music spot—want to grab drinks and listen together?",
        },
        {
          id: 'date-o-3',
          title: 'Spontaneous City Adventure',
          description: 'No strict agenda: sunset viewpoint, artisanal dessert spot, and late-night stroll.',
          whyItWorks: 'High testosterone & estrogen make spontaneous passion and spontaneity thrive.',
          sampleInvite: "Let's skip the routine tonight and go have an adventure somewhere fun!",
        },
      ]
    case 'luteal':
    default:
      return [
        {
          id: 'date-l-1',
          title: 'Low-Key Comfort Takeout & Series Binge',
          description: 'Order her favorite comfort food, light candles, and binge-watch a comfort show in pajamas.',
          whyItWorks: 'Reduces decision fatigue and cognitive strain while providing safe, cozy companionship.',
          sampleInvite: "Tonight is pajama night! I'll order our favorite takeout and queue up our show 🍕",
        },
        {
          id: 'date-l-2',
          title: 'Scenic Drive & Warm Cider/Hot Cocoa',
          description: 'Put on a chill playlist, take a relaxing evening drive to a scenic lookout with hot drinks.',
          whyItWorks: 'Gentle, soothing scenery without the sensory overwhelm of crowded venues.',
          sampleInvite: "Want to take a relaxing evening drive, sip hot cocoa, and listen to good music?",
        },
        {
          id: 'date-l-3',
          title: 'Candlelit Bath & Decadent Dessert',
          description: 'Prepare a warm bath with epsom salts and surprise her with decadent dessert afterwards.',
          whyItWorks: 'Epsom salts supply magnesium to soothe nervous system tension and relieve bloating.',
          sampleInvite: "I'll run a hot candlelit bath for you tonight and grab dessert for after 💕",
        },
      ]
  }
}

/**
 * Builds a curated grocery & comfort shopping checklist tailored to current phase & symptoms.
 */
export function getCareGroceryList(
  phase: Phase | null,
  entry: DayEntry | null,
): GroceryItem[] {
  const items: GroceryItem[] = []

  const cramps = entry?.cramps ?? 0
  const fatigue = entry?.fatigue ?? 0
  const bloating = entry?.bloating ?? 0
  const headache = entry?.headache ?? 0

  // Immediate symptom-driven items
  if (cramps > 0) {
    items.push({
      id: 'g-cramp-1',
      category: 'Drinks & Teas',
      name: 'Peppermint or Chamomile Herbal Tea',
      reason: 'Relaxes smooth uterine muscles to calm spasms',
      isUrgent: true,
    })
    items.push({
      id: 'g-cramp-2',
      category: 'Snacks & Cravings',
      name: 'Dark Chocolate (70%+ cacao)',
      reason: 'Rich in magnesium to ease cramping & boost serotonin',
      isUrgent: true,
    })
    items.push({
      id: 'g-cramp-3',
      category: 'Physical Comfort',
      name: 'Warm Heating Pad / Adhesive Heat Patches',
      reason: 'Direct soothing thermal relief for lower abdomen',
      isUrgent: true,
    })
  }

  if (bloating > 0) {
    items.push({
      id: 'g-bloat-1',
      category: 'Drinks & Teas',
      name: 'Fresh Ginger Root / Ginger Tea',
      reason: 'Natural digestive aid that speeds gastric emptying',
    })
    items.push({
      id: 'g-bloat-2',
      category: 'Snacks & Cravings',
      name: 'Bananas or Coconut Water',
      reason: 'Potassium counterbalances water retention and sodium',
    })
  }

  if (headache > 0 || fatigue > 0) {
    items.push({
      id: 'g-headache-1',
      category: 'Drinks & Teas',
      name: 'Electrolyte Hydration Drink / Coconut Water',
      reason: 'Rehydrates brain tissue and restores mineral balance',
      isUrgent: true,
    })
  }

  // Phase baseline essentials
  if (phase === 'menstrual') {
    items.push({
      id: 'g-m-1',
      category: 'Physical Comfort',
      name: 'Lavender Epsom Bath Salts',
      reason: 'Magnesium absorption through warm water soothes aching muscles',
    })
    items.push({
      id: 'g-m-2',
      category: 'Relief & Care',
      name: 'Ibuprofen or Favorite Pain Reliever',
      reason: 'Inhibits inflammatory prostaglandins that cause cramps',
    })
    items.push({
      id: 'g-m-3',
      category: 'Snacks & Cravings',
      name: 'Warm Savory Bone Broth or Miso Soup',
      reason: 'Gentle on digestion, replenishes lost iron and amino acids',
    })
  } else if (phase === 'luteal') {
    items.push({
      id: 'g-l-1',
      category: 'Snacks & Cravings',
      name: 'Roasted Salted Almonds / Pumpkin Seeds',
      reason: 'High zinc and magnesium to support progesterone stability',
    })
    items.push({
      id: 'g-l-2',
      category: 'Snacks & Cravings',
      name: 'Her Favorite Ice Cream or Comfort Dessert',
      reason: 'Metabolic calorie burn rises 100-300 kcal/d; lifts serotonin',
    })
    items.push({
      id: 'g-l-3',
      category: 'Drinks & Teas',
      name: 'Sparkling Water with Fresh Lemon',
      reason: 'Refreshing hydration without heavy sugar crashes',
    })
  } else {
    // Follicular / Ovulation
    items.push({
      id: 'g-f-1',
      category: 'Snacks & Cravings',
      name: 'Fresh Berries (Blueberries, Raspberries)',
      reason: 'High antioxidants to support cellular vitality & skin glow',
    })
    items.push({
      id: 'g-f-2',
      category: 'Drinks & Teas',
      name: 'Green Tea or Matcha',
      reason: 'Sustained L-theanine focus matching rising natural energy',
    })
    items.push({
      id: 'g-f-3',
      category: 'Snacks & Cravings',
      name: 'Avocados & Fresh Greens',
      reason: 'Healthy fats support healthy follicle maturation',
    })
  }

  return items
}

/**
 * Generates discreet, privacy-first iCalendar (.ics) format events for his personal calendar.
 */
export function generateDiscreetCalendarIcs(prediction: Prediction, cycleCount = 3): string {
  if (!prediction.anchorStart || !prediction.cycleLength) {
    return ''
  }

  const cycleLen = prediction.cycleLength
  let currentStart = prediction.anchorStart

  const events: { title: string; start: string; end: string; description: string }[] = []

  for (let i = 0; i < cycleCount; i++) {
    // Menstrual phase (~5 days)
    const mStart = currentStart
    const mEnd = addDays(currentStart, 5)

    // Follicular (~day 5 to day 12)
    const fStart = mEnd
    const fEnd = addDays(currentStart, Math.max(6, cycleLen - 16))

    // Peak vitality / Ovulation window (~day -16 to -12 from next cycle)
    const oStart = fEnd
    const oEnd = addDays(currentStart, Math.max(7, cycleLen - 12))

    // Luteal / Gentle Care (~day -12 to next start)
    const lStart = oEnd
    const nextStart = addDays(currentStart, cycleLen)

    events.push({
      title: 'Cycle: Rest & Comfort Window',
      start: mStart,
      end: mEnd,
      description: 'Her body is resting. Be extra caring, offer warm drinks, handle dinner chores.',
    })

    events.push({
      title: 'Cycle: High Energy & Ideas',
      start: fStart,
      end: fEnd,
      description: 'Rising stamina & optimism. Great window for active dates and projects together.',
    })

    events.push({
      title: 'Cycle: Peak Vitality & Romance',
      start: oStart,
      end: oEnd,
      description: 'Peak confidence & romantic chemistry. Excellent time for a special date night.',
    })

    events.push({
      title: 'Cycle: Gentle Care & Support',
      start: lStart,
      end: nextStart,
      description: 'Winding down. Validate, listen, stock comfort snacks, and give extra reassurance.',
    })

    currentStart = nextStart
  }

  // Format as RFC 5545 iCalendar string
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Our Cycle//Partner Companion v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Our Cycle Partner Companion',
    'X-WR-TIMEZONE:UTC',
  ]

  for (let idx = 0; idx < events.length; idx++) {
    const ev = events[idx]
    const s = ev.start.replace(/-/g, '')
    const e = ev.end.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:ourcycle-${s}-${idx}@ourcycle.local`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${s}`,
      `DTEND;VALUE=DATE:${e}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${ev.description}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// ============================================================================
// Custom Shopping List Helpers
// ============================================================================

export interface CustomShoppingItem {
  id: string
  name: string
  isDone: boolean
  tag: string
}

/**
 * Parses tags for custom shopping items added by her or partner.
 * Tags follow format: 'shop:<item name>' (pending) or 'shop:done:<item name>' (checked off).
 */
export function parseCustomShoppingItems(tags?: string[] | null): CustomShoppingItem[] {
  if (!tags || !Array.isArray(tags)) return []
  return tags
    .filter((t) => t.startsWith('shop:'))
    .map((t) => {
      const isDone = t.startsWith('shop:done:')
      const name = isDone ? t.slice('shop:done:'.length) : t.slice('shop:'.length)
      return {
        id: t,
        name,
        isDone,
        tag: t,
      }
    })
}

/**
 * Appends a custom shopping item tag. Sanitizes input and prevents duplicates.
 */
export function addCustomShoppingTag(
  currentTags: string[] | null | undefined,
  name: string,
): string[] {
  const clean = name.trim().replace(/^shop:(done:)?/, '')
  if (!clean) return currentTags ? [...currentTags] : []
  const tags = (currentTags ?? []).filter(
    (t) => t !== `shop:${clean}` && t !== `shop:done:${clean}`,
  )
  return [...tags, `shop:${clean}`]
}

/**
 * Toggles a custom shopping item between active and done.
 */
export function toggleCustomShoppingTag(
  currentTags: string[] | null | undefined,
  tag: string,
): string[] {
  const tags = currentTags ? [...currentTags] : []
  const idx = tags.indexOf(tag)
  if (idx === -1) return tags
  if (tag.startsWith('shop:done:')) {
    const rawName = tag.slice('shop:done:'.length)
    tags[idx] = `shop:${rawName}`
  } else if (tag.startsWith('shop:')) {
    const rawName = tag.slice('shop:'.length)
    tags[idx] = `shop:done:${rawName}`
  }
  return tags
}

/**
 * Removes a custom shopping item tag completely.
 */
export function removeCustomShoppingTag(
  currentTags: string[] | null | undefined,
  tag: string,
): string[] {
  if (!currentTags) return []
  return currentTags.filter((t) => t !== tag)
}

