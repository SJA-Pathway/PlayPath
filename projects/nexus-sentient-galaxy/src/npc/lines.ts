/**
 * Built-in alien dialogue data. Lets every alien hold a varied, in-character conversation
 * with no API key. Lines are templates; {slots} are filled from the game state:
 *
 *  {me} alien name · {addr} pilot name or "pilot" · {planet} · {system} · {biome} · {species}
 *  {faction} alien's faction · {vibe} faction description · {rival} a rival faction
 *  {pirates} pirate count in system · {rumorSys} a random other system · {visits}
 */
export type Temper = 'wary' | 'jovial' | 'cryptic' | 'mercantile' | 'proud' | 'melancholy';
export type Intent =
  | 'greet' | 'name' | 'insult' | 'compliment' | 'thanks' | 'bye' | 'who' | 'species' | 'lore' | 'biome'
  | 'faction' | 'pirates' | 'trade' | 'job' | 'rumor' | 'remember' | 'help' | 'joke' | 'feelings' | 'danger' | 'fallback';

/** Checked top to bottom; first match wins. */
export const INTENTS: [Intent, RegExp][] = [
  ['name', /\b(my name is|i am called|i'm called|call me|name's)\b|^(i am|i'm) [a-z]+\.?$/i],
  ['insult', /\b(idiot|stupid|dumb|hate you|shut up|ugly|kill you|worthless|loser|pathetic|useless|smell)\b/i],
  ['joke', /\b(joke|funny|laugh|humou?r|make me)\b/i],
  ['feelings', /\b(how are you|how do you feel|are you ok|happy|sad|lonely|feel)\b/i],
  ['compliment', /\b(beautiful|amazing|wonderful|love (your|this)|impressive|awesome|cool planet|nice (world|planet|place))\b/i],
  ['thanks', /\b(thanks|thank you|thx|grateful|appreciate)\b/i],
  ['bye', /\b(bye|goodbye|farewell|see you|later|leaving|gotta go)\b/i],
  ['remember', /\b(remember|last time|before|know me|forgot|recall)\b/i],
  ['pirates', /\b(pirate|pirates|syndicate|drone|drones|raid|raider|attack|enemy|enemies)\b/i],
  ['trade', /\b(trade|buy|sell|credit|credits|deal|money|price|data|scan|market|goods)\b/i],
  ['job', /\b(job|work|mission|contract|quest|task|bounty|hire|earn)\b/i],
  ['rumor', /\b(rumou?r|news|gossip|heard|secret|whisper|going on)\b/i],
  ['faction', /\b(faction|concord|choir|politic|politics|war|who rules|govern|leader|allies)\b/i],
  ['who', /\b(who are you|your name|what are you|about you|yourself)\b/i],
  ['species', /\b(species|your people|your kind|culture|customs|tradition|religion|eat|food)\b/i],
  ['biome', /\b(weather|climate|hot|cold|ice|ocean|lava|jungle|desert|toxic|air|sky|surface|land)\b/i],
  ['lore', /\b(planet|world|home|lore|history|here|place|tell me|about this|story|past)\b/i],
  ['danger', /\b(safe|danger|dangerous|hazard|risk|warning)\b/i],
  ['help', /\b(help|advice|tip|tips|how do i|what should|guide|lost)\b/i],
  ['greet', /\b(hello|hi|hey|greetings|yo|good (morning|evening|day)|howdy|sup)\b/i],
];

type Lines = Partial<Record<Temper | 'any', string[]>>;

export const LINES: Record<Intent, Lines> = {
  greet: {
    wary: ['State your business, {addr}, and keep your weapons cold.', 'You are on an open channel. Speak plainly.', 'I see your transponder, {addr}. What do you want?'],
    jovial: ['Ha! {addr}! Nobody comes to {planet} unless they are lost or interesting. Which are you?', 'Greetings, greetings! Pull up a docking clamp and talk to me.', 'A visitor! The {species} of {planet} welcome you, loudly.'],
    cryptic: ['The stars mentioned you would come. They did not say why.', 'Hello, {addr}. Or perhaps goodbye. It depends on where you stand in time.', 'Your signal arrived before your ship did. Curious.'],
    mercantile: ['Welcome, welcome! Everything on {planet} has a price. This greeting is free.', 'Ah, a customer. Or a supplier. Either way, hello, {addr}.', 'Greetings. I trust you came with cargo or credits.'],
    proud: ['You address a citizen of {planet}, an old and honoured world. Speak carefully.', 'The {species} acknowledge your arrival, {addr}.', 'Few pilots are granted a channel to me. Use it well.'],
    melancholy: ['Another ship. They come, they go. {planet} stays.', 'Hello, {addr}. It has been quiet here. Too quiet, maybe.', 'Oh. A voice. I had almost forgotten what they sound like.'],
  },
  name: {
    wary: ['{name}. Noted. Names are easy to give and hard to trust.', 'I will log that, {name}. Do not make me regret it.'],
    jovial: ['{name}! A fine name. I will shout it across the reef tonight.', '{name}, is it? I like you already. Probably.'],
    cryptic: ['{name}. The syllables already sound old, as if you have said them here before.', 'I will remember {name}. The stars already did.'],
    mercantile: ['{name}. Good. I keep a ledger, and now you are in it.', 'A pleasure, {name}. Names make invoices easier.'],
    proud: ['{name}. My people do not forget names, so wear yours with honour.', 'I will record {name} in the archive of {planet}.'],
    melancholy: ['{name}. I will remember it, even after you stop visiting.', 'A name to hold on to. Thank you, {name}.'],
  },
  insult: {
    wary: ['Noted. Your file just got longer, and not in a good way.', 'Say that again and the port authority will hear about it.'],
    jovial: ['Ouch! I will be telling everyone at the reef about you, and not kindly.', 'Ha. Rude. I will laugh about it later. Much later.'],
    cryptic: ['Words leave marks, pilot. Some last longer than ships.', 'The void heard that. It remembers everything.'],
    mercantile: ['That just raised your prices by twenty percent.', 'Insults are free. Forgiveness is not.'],
    proud: ['You insult {planet}? The archive of my people now has a page about you, and it is not flattering.', 'I have outlived better insults than yours, and their authors.'],
    melancholy: ['Of course. Everyone leaves something behind. You left that.', 'I expected nothing better. I am still disappointed.'],
  },
  compliment: {
    any: ['You have a good eye, {addr}. {planet} does not show her beauty to everyone.', 'Kind words. They are rarer out here than credits.'],
    proud: ['Naturally. But it is good to hear an outsider admit it.'],
    jovial: ['Stop, you will make my antennae blush!'],
    melancholy: ['It is beautiful. Sometimes I forget that. Thank you for reminding me.'],
  },
  thanks: {
    any: ['You are welcome, {addr}. Fly safely.', 'Think nothing of it. Well, think a little of it.'],
    mercantile: ['Gratitude is nice. Repeat business is nicer.'],
    wary: ['Do not thank me yet. The lanes are long.'],
    cryptic: ['Thank the stars. I am only their messenger.'],
  },
  bye: {
    wary: ['Go carefully. Watch your six.', 'Channel closing. Stay out of trouble.'],
    jovial: ['Leaving already? Come back soon, and bring stories!', 'Farewell, {addr}! Do not get blown up!'],
    cryptic: ['We will meet again. We already have, in a way.', 'Goodbye is just hello, spoken backwards.'],
    mercantile: ['Safe travels. Come back with cargo.', 'Farewell! Tell your friends about our prices.'],
    proud: ['You may go. {planet} will still be here.', 'Travel with honour, {addr}.'],
    melancholy: ['Goodbye. They always say goodbye.', 'Go on, then. I will be here, like always.'],
  },
  who: {
    any: ['I am {me}, {aSpecies} of {planet}. My people call me {temper}. Among other things.'],
    proud: ['I am {me}, keeper of records on {planet}, of the {species}, sworn to the {faction}.'],
    mercantile: ['{me}, trader, broker and occasional smuggler. The last one is a joke. Mostly.'],
    cryptic: ['I am {me}. Or I was. Or I will be. The {species} are not particular about tense.'],
    melancholy: ['Just {me}. {ASpecies} who stayed when everyone else left.'],
  },
  species: {
    any: ['We {species} value memory above all. We forget nothing, not even small kindnesses.', 'The {species} have lived on {planet} for longer than the Concord has had a name.'],
    jovial: ['We {species} eat three times a day, sing twice, and argue constantly.'],
    cryptic: ['The {species} do not sleep. We remember instead.'],
    proud: ['The {species} built the first beacon in this system, long before your kind learned to fly.'],
    mercantile: ['We {species} have a saying: a friend is a deal that has not ended yet.'],
  },
  lore: { any: ['{lore}'] },
  biome: {
    any: ['{planet} is {aBiome} world. You learn to respect it, or it learns to forget you.', 'The surface is {biome} and harsher than it looks from orbit. Land if you dare; the wildlife is curious.'],
    jovial: ['{biome} all year round! We call it character.'],
    melancholy: ['The seasons do not change much on a {biome} world. Neither do I.'],
  },
  faction: {
    any: ['I stand with the {faction}. We are {vibe}.', 'The {faction} keeps {planet} running. The {rival}? Make your own mind up about them.'],
    wary: ['Politics gets pilots killed. I will just say the {faction} pays my docking fees.'],
    cryptic: ['Factions rise like tides. The {faction} is high water today.'],
    proud: ['The {faction} is the only rule worth following in this system.'],
  },
  pirates: {
    any: ['{pirateLine}'],
  },
  trade: { any: ['{tradeLine}'] },
  job: {
    any: ['Check the contract board at the nearest station. Or thin out the Syndicate here and I will make it worth your while.', 'Work? The Syndicate has been harassing our convoys. Every drone you bring down helps.'],
    mercantile: ['Work is just trade with extra steps. Pirate bounties pay well this week.'],
  },
  rumor: {
    any: [
      'They say a Choir pilgrim heard the star at {rumorSys} singing out of tune.',
      'Word is the Syndicate is paying double for Concord transponder codes.',
      'A survey crew near {rumorSys} found ruins older than any known species. Then they stopped reporting.',
      'I heard a freighter captain sold a whole cargo of ice to a desert world, then bought it back as water. Clever.',
      'The {rival} is massing ships near {rumorSys}. Or so they say in the bars.',
      'Somebody tamed a predator on a jungle world. It ate their landing gear.',
    ],
  },
  remember: { any: ['{memoryLine}'] },
  help: {
    any: [
      'Scan every world you pass (C). Survey data sells, and I buy it.',
      'If pirates chase you, boost away and turn to fight when they overshoot. They always overshoot.',
      'Dock at a station (E) to repair and upgrade. Better shields have saved more pilots than courage.',
      'Land on a rocky world (L) and hover near the wildlife. Slowly, or they scatter.',
      'Missiles need a lock. Keep your target in front of you until the tone goes steady.',
    ],
  },
  joke: {
    any: ['Why did the drone cross the asteroid belt? It did not. That is why we have so much scrap.', 'A Concord officer, a Syndicate smuggler and a Choir mystic walk into an airlock. Only one of them read the manual.'],
    jovial: ['What do you call a pilot with no shields? Brave. Briefly.', 'I tried to tell a joke about FTL travel, but you would have laughed before I finished it.'],
    cryptic: ['The joke is that you think this is a conversation.'],
    proud: ['The {species} do not tell jokes. We tell histories. Some of them are funny.'],
    melancholy: ['A joke? Here is one: I thought things would get better.'],
  },
  feelings: {
    any: ['Well enough, for {aSpecies} on {aBiome} world.', 'Better now that someone is talking to me.'],
    melancholy: ['Tired. The kind of tired that sleep does not fix.'],
    jovial: ['Wonderful! I always am. It annoys people.'],
    wary: ['Alert. Which is the same as well, out here.'],
  },
  danger: {
    any: ['{planet} is rated {hazard} hazard. The surface does not forgive careless landings.', '{pirateLine}'],
  },
  fallback: {
    wary: ['I have said enough, {addr}. Ask what you came to ask.', 'I do not follow. Speak plainly, {addr}.'],
    jovial: ['You talk like a customs form. Ask me something fun!', 'Ha! I have no idea what that means. Try me with pirates, trade or gossip.'],
    cryptic: ['Some answers only arrive when you stop asking.', 'That question has no shape yet. Ask it again, differently.'],
    mercantile: ['If it is not a deal, it is just noise, friend.', 'Interesting. Is there money in it?'],
    proud: ['That is beneath a proper answer. Ask about {planet}, or the {faction}.', 'My patience is long, but it is not infinite.'],
    melancholy: ['Everything passes. Even this conversation.', 'I do not know. I stopped knowing things a while ago.'],
  },
};

/** Tone shifts layered on top of a reply, based on how the alien feels about the pilot. */
export const COLD_PREFIX = ['*static* ', 'Hmph. ', 'Fine. ', '(coldly) '];
export const WARM_SUFFIX = [' Good to hear from you, friend.', ' You are always welcome here.', ' My people speak well of you.'];

/** Gossip about the pilot, carried between aliens of the same faction. */
export const GOSSIP_GOOD = ['{other} of {otherPlanet} speaks well of you.', 'Word travels. {other} on {otherPlanet} says you can be trusted.'];
export const GOSSIP_BAD = ['{other} of {otherPlanet} warned me about you.', 'I heard what you said to {other} on {otherPlanet}. We talk, you know.'];
