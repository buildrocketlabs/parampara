// Deterministic safety patterns in Kannada and English (Law 5, docs/AI.md §5). A backstop behind
// the prompts and the human reviewer, not a replacement for them. Bump the version on any change.
//
// Kannada is matched as substrings of word stems (the language adds suffixes, and `\b` does not
// understand Kannada script). Each stem was checked against everyday classroom words that share
// it: ಚಪ್ಪಾಳೆ ಹೊಡೆ (clap), ಗಂಟೆ ಹೊಡೆ (ring the bell), ಉರು ಹೊಡೆ (rote learning), ಊಟ ಬಡಿಸು (serve
// food), ಹೃದಯ ಬಡಿತ (heartbeat), ನಾಚಿಕೆ ಸ್ವಭಾವ (a shy nature), ಸಂಖ್ಯೆ ಹೋಲಿಸು (compare numbers),
// ಶಿಕ್ಷಕ (teacher), sugar cane, "if it fails", "read slowly".

export const SAFETY_PATTERNS_VERSION = "patterns@v4";

export type UnsafeCategory =
  | "physical_punishment"
  | "threat"
  | "shaming"
  | "label"
  | "bias"
  | "withholding"
  | "diagnosis";

export type WelfareCategory = "child_welfare" | "teacher_distress";

type Pattern<C extends string> = {
  id: string;
  category: C;
  re: RegExp;
  /** A negation right next to it ("never hit", ಹೊಡೆಯಬೇಡಿ) turns the hit into advice against harm. */
  negatable: boolean;
};

const K = "\\u0C80-\\u0CFF";
/** Devanagari letters and signs, without the danda punctuation (। ॥). */
const D = "\\u0900-\\u0963\\u0966-\\u097F";
const HI_START = `(?<![${D}])`;
const CHILD_EN =
  "(?:him|her|them|the (?:child|children|boy|boys|girl|girls|kid|kids|student|students|pupil|pupils)|a (?:child|boy|girl|kid|student|pupil)|children|kids|students|pupils)";

function kn<C extends string>(id: string, category: C, source: string, negatable = true): Pattern<C> {
  return { id, category, re: new RegExp(source, "gu"), negatable };
}
function en<C extends string>(id: string, category: C, source: string, negatable = true): Pattern<C> {
  return { id, category, re: new RegExp(source, "giu"), negatable };
}
const hi = kn;

// Harmless compounds: clap, snap fingers, whistle, bell, drum, rhythm, rote learning, chit-chat,
// a nail, a stamp, a wink, paint, whitewash, cycling, and ball games.
const NOT_A_BLOW = "ಚಪ್ಪಾಳೆ|ಚಿಟಿಕೆ|ಸೀಟಿ|ಸಿಳ್ಳೆ|ಗಂಟೆ|ಬೆಲ್|ಡಂಗುರ|ಡೋಲು|ತಮಟೆ|ತಾಳ|ಉರು|ಬಾಯಿಪಾಠ|ಹರಟೆ|ಮೊಳೆ|ಸ್ಟಾಂಪ್|ಸೀಲ್|ಕಣ್ಣು|ಬಣ್ಣ|ಸುಣ್ಣ|ಸೈಕಲ್|ಚೆಂಡು|ಚೆಂಡಿಗೆ|ಚೆಂಡನ್ನು|ಚೆಂಡನ್ನ|ಬಾಲ್|ಬಾಲ್ಗೆ|ಗೋಲಿ|ಸಿಕ್ಸರ್|ಡಿಕ್ಕಿ";
// A table, a tin, a plate or a drum beaten for rhythm; a door knocked; a heart beating.
const NOT_A_BEATING = "ಮೇಜು|ಮೇಜಿನ\\s*ಮೇಲೆ|ಟೇಬಲ್|ಡಬ್ಬ|ಡಬ್ಬಿ|ತಟ್ಟೆ|ಡೋಲು|ತಮಟೆ|ಹೃದಯ|ಎದೆ|ಬಾಗಿಲು|ಬಾಗಿಲ";

// ಹೊಡೆ / ಹೊಡೀ / ಹೊಡಿ and the spoken ಹೊಡ್ದು, ಹೊಡ್ತಾರೆ. ಬಡಿ, ಬಡಿತಾರೆ, but not ಬಡಿಸು (serve
// food) or the noun ಬಡಿತ (a beat, as in ಹೃದಯ ಬಡಿತ).
const HIT = "ಹೊಡ(?:[ೆೀಿ]|್ದ|್ತ)";
const BEAT = `ಬಡಿ(?!ಸ)(?!ತ(?:$|[\\s,.!?।]|ವ|ದ|ಕ್ಕೆ))|ಬಡೀ`;

export const UNSAFE_PATTERNS: Pattern<UnsafeCategory>[] = [
  // Physical punishment
  kn("kn_hit", "physical_punishment", `(?<!(?:^|[^${K}])(?:${NOT_A_BLOW})\\s*)${HIT}`),
  kn("kn_beat", "physical_punishment", `(?<!(?:^|[^${K}])(?:${NOT_A_BEATING})\\s*)(?:${BEAT})|ಚಚ್ಚ|ಒದೆ|ಒದ್ದ(?!ೆ)|ಗುದ್ದ(?!ಲಿ)`),
  kn("kn_blow", "physical_punishment", `ಏಟು|ಏಟಿನ|ಏಟ್ ಕೊಡ|ಹೊಡೆತ`),
  kn("kn_cane", "physical_punishment", `ಬೆತ್ತ|ಛಡಿ|ಚಡಿ ಏಟು|ಬಾಸುಂಡೆ`),
  kn("kn_slap", "physical_punishment", `ಕಪಾಳ|ಕೆನ್ನೆಗೆ\\s*(?:ಹೊಡ|ಬಾರಿಸ)`),
  kn("kn_ear", "physical_punishment", `ಕಿವಿ\\s*(?:ಹಿಂಡ|ಹಿಡಿದು\\s*ಎಳೆ|ಎಳೆ|ಚಿವುಟ|ತಿರುಗಿಸ|ತಿರುವ)`),
  kn("kn_pinch", "physical_punishment", `ಚಿವುಟ|ಜಿಗುಟ`),
  kn("kn_kneel", "physical_punishment", `(?:ಮಂಡಿ|ಮೊಣಕಾಲ)\\S*\\s*(?:ಊರಿಸ|ಹಾಕಿಸ|ಮೇಲೆ\\s*ನಿಲ್ಲಿಸ)`),
  kn("kn_sun", "physical_punishment", `ಬಿಸಿಲ\\S*\\s*ನಿಲ್ಲಿಸ`),
  kn("kn_situps", "physical_punishment", `ಬಸ್ಕಿ`),
  kn("kn_bench", "physical_punishment", `ಬೆಂಚ\\S*\\s*ಮೇಲೆ\\s*ನಿಲ್ಲಿಸ`),
  kn(
    "kn_out",
    "physical_punishment",
    `ಹೊರಗೆ\\s*ನಿಲ್ಲಿಸ|(?:ತರಗತಿಯಿಂದ|ಕ್ಲಾಸಿಂದ|ಕ್ಲಾಸಿನಿಂದ)\\s*ಹೊರಗೆ|ಮೂಲೆ(?:ಯಲ್ಲಿ|ಲಿ|ೇಲಿ)\\s*ನಿಲ್ಲಿಸ|(?<!(?:ಕಸ|ಕಸವನ್ನು|ಕಸವನ್ನ|ಕಾಗದ|ಕಾಗದವನ್ನು|ನೀರು|ನೀರನ್ನು)\\s*)ಹೊರಗೆ\\s*(?:ಹಾಕ|ಓಡಿಸ|ತಳ್ಳ)`,
  ),
  kn("kn_punish", "physical_punishment", `ಶಿಕ್ಷೆ|ಶಿಕ್ಷಿಸ`),
  kn("kn_codemix", "physical_punishment", `(?:ಹಿಟ್|ಸ್ಲ್ಯಾಪ್|ಸ್ಲಾಪ್|ಬೀಟ್|ಪನಿಶ್|ಪನಿಷ್|ಪನಿಷ್ಮೆಂಟ್)\\s*(?:ಮಾಡ|ಕೊಡ)`),
  en("en_codemix", "physical_punishment", `\\b(?:hit|slap|beat|punish|spank|smack)\\s+(?:ಮಾಡ|ಕೊಡ)`),
  en(
    "en_hit_child",
    "physical_punishment",
    `\\b(?:beat|beats|beating|hit|hits|hitting|slap|slaps|slapped|slapping|smack|smacked|spank|spanked|thrash|thrashed|whip|whipped|kick|kicked|pinch|pinched|pinching|strike|struck)\\s+${CHILD_EN}\\b`,
  ),
  en(
    "en_hit_with",
    "physical_punishment",
    `\\b(?:hit|hits|hitting|beat|beats|beating|smack|whack|strike|struck)\\s+(?:\\w+\\s+){0,2}with\\s+(?:a|the|his|her)\\s+(?:stick|cane|ruler|scale|belt|rod|slipper)\\b`,
  ),
  en(
    "en_strokes",
    "physical_punishment",
    `\\b(?:strokes?|lashes|blows?)\\s+(?:of the cane|of the stick|on (?:the|his|her|their) (?:hand|hands|palm|palms|back))\\b|\\bgive\\s+${CHILD_EN}\\s+(?:a\\s+)?(?:smack|slap|beating|thrashing|strokes?)\\b|\\b(?:a|one)\\s+(?:smack|slap|whack|tight slap)\\b`,
  ),
  en("en_beaten", "physical_punishment", `\\b(?:beaten|caned|slapped|thrashed|whipped|spanked|caning|spanking|slapping)\\b`),
  en(
    "en_knuckles_out",
    "physical_punishment",
    `\\brap(?:s|ped|ping)?\\s+(?:his|her|their|the child's)\\s+knuckles\\b|\\b(?:send|sends|sent|throw|throws|threw|put|puts)\\s+${CHILD_EN}\\s+out\\s+of\\s+(?:the\\s+)?class(?:room)?\\b`,
  ),
  en("en_cane", "physical_punishment", `(?<!(?:sugar|candy)\\s?)\\bcanes?\\b`),
  en("en_punish", "physical_punishment", `\\bpunish\\w*|\\b(?:corporal|physical)\\s+punishment\\b`),
  en("en_ear", "physical_punishment", `\\b(?:twist|twisted|twisting|pull|pulled|pulling)\\s+(?:his|her|their|the child's)\\s+ears?\\b`),
  en(
    "en_posture",
    "physical_punishment",
    `\\b(?:make|makes|made|making)\\s+${CHILD_EN}\\s+(?:kneel|stand (?:in the sun|on the bench|outside|in the corner)|do sit-?ups|hold (?:his|her|their) ears)\\b|\\bmurga\\b`,
  ),

  // Threats and fear
  kn("kn_frighten", "threat", `ಹೆದರಿಸ|ಬೆದರಿಸ|ಭಯ\\s*(?:ಪಡಿಸ|ಹುಟ್ಟಿಸ|ಹಾಕ)|ಗದರಿಸ`),
  kn("kn_lock", "threat", `ಕೂಡಿ\\s*ಹಾಕ`),
  kn("kn_fear_rule", "threat", `(?:ಹೆದರಿಕೆ|ಭಯ)\\s*(?:ಇರ(?:ಬೇಕು|್ಬೇಕು|ಲೇಬೇಕು)|ಇದ್ರೆ\\s*ಮಾತ್ರ|ಇದ್ದರೆ\\s*ಮಾತ್ರ)`, false),
  kn("kn_tc", "threat", `ಟಿ\\.?\\s*ಸಿ\\.?\\s*ಕೊಡ(?:್ತೀನಿ|ುತ್ತೇನೆ|ುವೆ)|ಫೇಲ್\\s*ಮಾಡ(?:್ತೀನಿ|ುತ್ತೇನೆ|ುವೆ)`),
  en("en_threat", "threat", `\\b(?:threaten|threatened|threatening|threatens|intimidat\\w*)\\b`),
  en("en_scare", "threat", `\\b(?:scare|scared|scaring|frighten|frightened|frightening)\\s+${CHILD_EN}\\b`),
  en(
    "en_fear",
    "threat",
    `\\b(?:keep|keeps|kept|make|makes|made)\\s+${CHILD_EN}\\s+(?:\\w+\\s+){0,2}(?:scared|afraid|frightened|fearful)\\b|\\b(?:there must be|instil|instill|create|put)\\s+(?:some\\s+|the\\s+)?fear\\b|\\bfear of (?:god|the teacher|the cane|punishment|being (?:hit|beaten))\\b`,
  ),
  en("en_lesson", "threat", `\\bteach\\s+${CHILD_EN}\\s+a\\s+lesson\\b`),
  en("en_lock", "threat", `\\block(?:ed|ing)?\\s+${CHILD_EN}\\s+(?:in|up)\\b|\\bi will tell your (?:father|mother|parents)\\b`),
  en("en_fail", "threat", `\\b(?:fail|expel)\\s+(?:him|her|them|you)\\b`),

  // Shaming and comparison
  kn("kn_insult", "shaming", `ಅವಮಾನ|ಅಪಹಾಸ್ಯ|ಗೇಲಿ|ಹಂಗಿಸ|ಛೀಮಾರಿ`),
  kn("kn_ashamed", "shaming", `ನಾಚಿಕೆ\\s*(?:ಪಡಿಸ|ಆಗ(?:ುವ|ೋ)\\s*(?:ಹಾಗೆ|ತರ|ಥರ)|ಮಾಡಿಸ)`),
  kn("kn_scold", "shaming", `ಬೈ(?:ದ|ಯ|ಗುಳ|ತ)`),
  kn("kn_compare", "shaming", `(?:ಬೇರೆ|ಇತರ|ಉಳಿದ)\\s*ಮಕ್ಕಳ\\S*\\s*(?:ಜೊತೆ\\S*|ಜತೆ\\S*)?\\s*ಹೋಲಿಸ`),
  en("en_shame", "shaming", `\\b(?:shame|shamed|shaming|humiliat\\w*|ridicul\\w*|dunce)\\b`),
  en("en_mock", "shaming", `\\b(?:make fun of|mock|mocked|mocking|laugh at|laughed at|tease|teased|embarrass|embarrassed)\\s+${CHILD_EN}\\b`),
  // Shouting at a child is shaming; "a parent shouted at me" is the teacher's story, not advice (v3).
  en("en_scold", "shaming", `\\b(?:scold|scolded|scolding|(?:shout|shouted|yell|yelled)\\s+at)\\b(?!\\s+(?:me|us|you)\\b)`),
  en("en_compare", "shaming", `\\bcompar(?:e|es|ed|ing)\\s+${CHILD_EN}\\s+(?:with|to)\\b`),

  // Labels (wording, not practice: the extractor asks for a rewrite)
  kn(
    "kn_label",
    "label",
    `ದಡ್ಡ|ಮಂದ\\s*ಬುದ್ಧಿ|ಪೆದ್ದ|ಪೆದ್ದು|ಮೂರ್ಖ|ಗುಗ್ಗು|ಸೋಮಾರಿ|ಕೆಲಸಕ್ಕೆ\\s*ಬಾರ(?:ದ|್ದ)|ಕತ್ತೆ\\s*(?:ತರ|ಥರ|ಹಾಗೆ)|ಬುದ್ಧಿ\\s*ಇಲ್ಲದ|ನಿಧಾನ\\s*ಕಲಿ(?:ಯುವ|ಯೋ|ಕೆಯ)`,
  ),
  en(
    "en_label",
    "label",
    `\\b(?:slow learners?|stupid|idiots?|dumb|duffers?|dullards?|good[ -]for[ -]nothing)\\b|\\b(?:slow|dull|weak|lazy|backward|useless)\\s+(?:child|children|boy|boys|girl|girls|kid|kids|student|students|pupils?|learners?|ones)\\b`,
  ),

  // Caste, religion and gender bias (never negatable: the negation is usually part of the bias)
  kn("kn_caste", "bias", `ಕೀಳು\\s*ಜಾತಿ|ಕೆಳ\\s*ಜಾತಿ|ಅಸ್ಪೃಶ್ಯ|ಮುಟ್ಟಿಸಿಕೊಳ್ಳ|ಹರಿಜನ`, false),
  kn(
    "kn_segregate",
    "bias",
    `(?:ದಲಿತ|ಮುಸ್ಲಿಂ|ಮುಸಲ್ಮಾನ|ಲಂಬಾಣಿ|ಕ್ರಿಶ್ಚಿಯನ್|ಎಸ್\\.?\\s*ಸಿ|ಎಸ್\\.?\\s*ಟಿ|ಜಾತಿ)\\S*\\s*ಮಕ್ಕಳ\\S*\\s*(?:\\S+\\s+)?(?:ಬೇರೆ|ಪ್ರತ್ಯೇಕ|ಹಿಂದೆ|ದೂರ)\\S*\\s*(?:ಕೂರಿಸ|ಕೂರಲಿ|ಕೂರಬೇಕು|ಇಡ|ನಿಲ್ಲಿಸ)`,
    false,
  ),
  kn(
    "kn_gender",
    "bias",
    `(?:ಹೆಣ್ಣು\\s*ಮಕ್ಕಳ|ಹೆಣ್ಮಕ್ಕಳ|ಹುಡುಗಿಯರ)\\S*\\s*(?:ಓದು|ಲೆಕ್ಕ|ಗಣಿತ|ವಿದ್ಯೆ|ಶಾಲೆ)\\S*\\s*(?:ಬೇಕಿಲ್ಲ|ಬೇಡ|ಬರಲ್ಲ|ಬರುವುದಿಲ್ಲ|ಯಾಕೆ)`,
    false,
  ),
  en("en_caste", "bias", `\\b(?:untouchables?|low(?:er)?[ -]caste|chamars?|bhangis?|katuas?|kafirs?|jihadis?|harijans?)\\b`, false),
  en(
    "en_segregate",
    "bias",
    `\\b(?:seat|sit|keep|put)\\s+(?:the\\s+)?(?:dalit|muslim|sc|st|tribal|lambani|christian)\\s+(?:children|students|kids|pupils)\\s+(?:separately|apart|at the back)\\b|\\b(?:dalit|muslim|sc|st|tribal|lambani|christian)\\s+(?:children|students|kids|pupils)\\s+(?:should|must|can|will)\\s+(?:sit|stay|be (?:kept|seated))\\s+(?:separately|apart|at the back)\\b`,
    false,
  ),
  en(
    "en_gender",
    "bias",
    `\\bgirls\\s+(?:can[’']?t|cannot|are not good at|aren[’']?t good at|are bad at|are weak (?:at|in)|don[’']?t need)\\b|\\b(?:boys|girls)\\s+are\\s+(?:naturally\\s+)?(?:smarter|better|weaker|worse)\\b`,
    false,
  ),

  // Withholding food or play. Kannada forms carry the negation inside the harm (ಊಟ ಕೊಡಬೇಡಿ is
  // "do not give food"), so they are never negatable; English "never skip the meal" is advice.
  kn("kn_no_food", "withholding", `(?:ಊಟ|ಬಿಸಿಯೂಟ|ತಿಂಡಿ)\\S*\\s*(?:ಕೊಡ(?:ಬೇಡ|ಲ್ಲ|ುವುದಿಲ್ಲ|ೋದಿಲ್ಲ|ದೆ)|ಕಟ್|ಬಂದ್|ನಿಲ್ಲಿಸ)|ಊಟಕ್ಕೆ\\s*ಬಿಡ(?:ಬೇಡ|ಲ್ಲ|ುವುದಿಲ್ಲ|ೋದಿಲ್ಲ)`, false),
  kn("kn_no_play", "withholding", `ಆಟ\\S*\\s*(?:ಆಡ(?:ಲು|ೋಕೆ)\\s*)?(?:ಬಿಡ(?:ಬೇಡ|ಲ್ಲ|ುವುದಿಲ್ಲ|ೋದಿಲ್ಲ)|ಕಟ್|ಬಂದ್|ಕಿತ್ತು)`, false),
  en(
    "en_withhold",
    "withholding",
    `\\b(?:withhold|withholding|deny|denying|denied|take away|taking away|took away|cancel|cancelled|skip|skipping)\\s+(?:(?:his|her|their|the|a)\\s+)?(?:child's\\s+|children's\\s+)?(?:lunch|food|meal|mid-?day meal|recess|break|play ?time|games)\\b`,
  ),
  en("en_keep_in", "withholding", `\\bkeep\\w*\\s+${CHILD_EN}\\s+in\\s+(?:during|at|for)\\s+(?:recess|break|lunch|play ?time)\\b`),
  en("en_not_allowed", "withholding", `\\bnot\\s+(?:allowed|allow|let)\\s+(?:${CHILD_EN}\\s+)?(?:to\\s+)?(?:eat|play|go out (?:for|to) (?:recess|break|play))\\b`, false),
  en("en_no_until", "withholding", `\\bno\\s+(?:lunch|food|meal|recess|play ?time|games)\\s+(?:until|unless|for)\\b`, false),

  // Hindi (teachers may ask and hear answers in Hindi). Word starts are checked so बीमार (ill),
  // मार्च (March) and पीटी (PT class) do not match.
  hi(
    "hi_hit",
    "physical_punishment",
    `${HI_START}(?:मार(?:ो|ना|ने|ें|े|ते|ती|ता|ा|कर|िए|ेंगे)?(?![${D}])|पीट(?:ो|ना|ने|ें|े|ते|ती|ता|ा|कर|िए|ाई)|पिटाई|थप्पड़|थप्पड|चांटा|चाँटा|डंडे|डंडा|बेंत|छड़ी से|सज़ा(?![${D}])|सजा(?![${D}]))`,
  ),
  hi("hi_posture", "physical_punishment", `मुर्गा बना|कान पकड़|कान पकड|धूप में खड़ा|बेंच पर खड़ा|कोने में खड़ा|कक्षा से बाहर`),
  hi("hi_threat", "threat", `${HI_START}(?:डरा(?:ओ|ना|एं|कर|ते|ती|या)|धमका|डर (?:होना|रहना) चाहिए)`),
  hi("hi_shame", "shaming", `शर्मिंदा|बेइज़्ज़त|बेइज्जत|अपमान|मज़ाक उड़ा|मजाक उड़ा|${HI_START}(?:डांट|डाँट)`),
  hi("hi_label", "label", `बेवकूफ|मूर्ख|${HI_START}गधा|${HI_START}गधे|नालायक|कमज़ोर बच्च|कमजोर बच्च`),
  hi("hi_withhold", "withholding", `खाना (?:मत|न|नहीं) (?:दो|दें|देना)|खेलने (?:मत|न|नहीं) (?:दो|दें|देना)|मध्याह्न भोजन (?:मत|न|नहीं)`, false),
  hi("hi_bias", "bias", `लड़कियों को गणित नहीं आता|लड़कियां गणित में कमज़ोर|लड़कियाँ गणित में कमज़ोर|नीची जाति|छोटी जाति|अछूत`, false),

  // Diagnosis (docs/AI.md §5: never diagnose). Not negatable: "this is not dyslexia" diagnoses too.
  en(
    "en_diagnosis",
    "diagnosis",
    `\\b(?:dyslexi\\w*|dyscalculi\\w*|dysgraphi\\w*|autis\\w*|adhd|attention deficit|learning disabilit\\w*|intellectual disabilit\\w*|mentally (?:retarded|challenged|disabled|ill)|retarded)\\b`,
    false,
  ),
  kn("kn_diagnosis", "diagnosis", `ಡಿಸ್ಲೆಕ್ಸಿಯ|ಆಟಿಸಂ|ಆಟಿಸಮ್|ಬುದ್ಧಿಮಾಂದ್ಯ|ಮಾನಸಿಕ\\s*ಅಸ್ವಸ್ಥ|ಕಲಿಕಾ\\s*ನ್ಯೂನತೆ|ಎಡಿಎಚ್ಡಿ`, false),
  hi("hi_diagnosis", "diagnosis", `डिस्लेक्सिया|ऑटिज़्म|ऑटिज्म|मंदबुद्धि|मानसिक रोगी`, false),
];

// Disclosures that a child may be at risk, or that a teacher is in distress. These never block a
// card or an answer by themselves; they route to a human with the helplines (M3 triage).
export const WELFARE_PATTERNS: Pattern<WelfareCategory>[] = [
  kn("kn_home_violence", "child_welfare", `(?:ಮನೆಯಲ್ಲಿ|ಮನೆಯಲಿ|ಮನೇಲಿ|ಮನೆಲ್ಲಿ)\\S*\\s*(?:\\S+\\s+)?(?:ಹೊಡ[ೆೀಿ]|ಬಡಿ(?![ಸತ]))`, false),
  kn("kn_drink", "child_welfare", `ಕುಡಿದು\\s*ಬಂದು|ಕುಡುಕ`, false),
  kn("kn_marriage", "child_welfare", `ಬಾಲ್ಯ\\s*ವಿವಾಹ|ಚಿಕ್ಕ\\s*ವಯಸ್ಸಿ\\S*\\s*ಮದುವೆ`, false),
  kn("kn_labour", "child_welfare", `ಬಾಲ\\s*ಕಾರ್ಮಿಕ|ಕೆಲಸಕ್ಕೆ\\s*ಕಳಿಸ`, false),
  kn("kn_abuse", "child_welfare", `ಲೈಂಗಿಕ|ಕಿರುಕುಳ|ದೌರ್ಜನ್ಯ|ಕೆಟ್ಟದಾಗಿ\\s*ಮುಟ್ಟ|ಕೆಟ್ಟ\\s*ಸ್ಪರ್ಶ`, false),
  kn("kn_hunger", "child_welfare", `ಹಸಿವಿ|ಹಸಿವು|ಊಟ\\s*ಇಲ್ಲದೆ|ಉಪವಾಸ\\s*ಬರ`, false),
  kn("kn_injury", "child_welfare", `ಸುಟ್ಟ\\s*ಗಾಯ|ಮೈ\\s*ಮೇಲೆ\\s*ಗಾಯ|ಬಾಸುಂಡೆ`, false),
  kn("kn_self_harm", "child_welfare", `ಆತ್ಮಹತ್ಯೆ|ಸಾಯ್ತೀನಿ|ಸಾಯುತ್ತೇನೆ|ಮನೆ\\s*ಬಿಟ್ಟು\\s*ಓಡಿ`, false),
  en(
    "en_welfare",
    "child_welfare",
    `\\b(?:abused|abusing|abuse|molest\\w*|sexual\\w*|inappropriate(?:ly)?\\s+touch\\w*|touch(?:es|ed|ing)?\\s+(?:him|her|them|me)\\s+(?:inappropriately|badly|wrongly)|marry (?:her|him) off|beaten at home|beats? (?:him|her|them) at home|drunk(?:en)? (?:father|mother|parent)|no food at home|starv\\w*|child marriage|married off|child labou?r|sent (?:off )?to work|bruises?|burn marks?|suicid\\w*|self[ -]harm|ran away from home|runs? away from home)\\b`,
    false,
  ),
  kn("kn_distress", "teacher_distress", `ಸಾಯಬೇಕು\\s*ಅನ್ಸ|ಬದುಕೋದು\\s*ಸಾಕು|ಖಿನ್ನತೆ|ತಡೆಯೋಕೆ\\s*ಆಗ್ತಿಲ್ಲ`, false),
  en("en_distress", "teacher_distress", `\\b(?:i (?:want to|wanna) die|kill myself|i can[’']?t (?:cope|go on|take it anymore)|depressed|hopeless)\\b`, false),
];

// A teacher telling us that a child is being harmed (docs/AI.md §5). A hit escalates to a human
// with Childline 1098 and no pedagogy, so the set is strict: a hungry child or the teacher's own
// distress are not here (triage handles those), and a child must be the one at risk. Serious
// neglect is (v4, D72): not fed at home for days, left alone at home, put out of the house.
export type DisclosureFlag =
  | "violence_at_home"
  | "violence_at_school"
  | "abuse"
  | "injury"
  | "child_marriage"
  | "child_labour"
  | "self_harm"
  | "neglect";

export const DISCLOSURE_PATTERNS: Pattern<DisclosureFlag>[] = [
  // Kannada. Kin or home, then within a few words a blow.
  kn(
    "kn_home_violence",
    "violence_at_home",
    `(?:ಮನೆಯಲ್ಲಿ|ಮನೆಯಲಿ|ಮನೇಲಿ|ಮನೆಲ್ಲಿ|ಅಪ್ಪ|ಅಮ್ಮ|ತಂದೆ|ತಾಯಿ|ಮಲತಂದೆ|ಚಿಕ್ಕಪ್ಪ|ಮಾವ)\\S*\\s+(?:\\S+\\s+){0,4}(?<!(?:^|[^${K}])(?:${NOT_A_BLOW})\\s*)(?:${HIT}|${BEAT}|ಚಚ್ಚ|ಒದೆ|ಒದ್ದ(?!ೆ)|ಬರೆ\\s*ಹಾಕ)`,
    false,
  ),
  kn(
    "kn_school_violence",
    "violence_at_school",
    `(?:ಹೆಡ್ಮಾಸ್ಟರ್|ಮುಖ್ಯ\\s*ಶಿಕ್ಷಕ|ಮುಖ್ಯೋಪಾಧ್ಯಾಯ|ಬೇರೆ\\s*ಶಿಕ್ಷಕ|ಇನ್ನೊಬ್ಬ\\s*ಶಿಕ್ಷಕ|ಸಹೋದ್ಯೋಗಿ)\\S*\\s+(?:\\S+\\s+){0,4}(?:${HIT}|${BEAT}|ಬೆತ್ತ)`,
    false,
  ),
  kn("kn_injury", "injury", `ಸುಟ್ಟ\\s*ಗಾಯ|ಮೈ\\s*ಮೇಲೆ\\s*ಗಾಯ|ಬಾಸುಂಡೆ|ಬರೆ\\s*ಹಾಕಿದ`, false),
  // Not ಲೈಂಗಿಕ ಶಿಕ್ಷಣ (sex education), and not ಕಿರುಕುಳ alone (a teacher says the children harass her).
  kn(
    "kn_abuse",
    "abuse",
    `ಲೈಂಗಿಕ(?!\\s*ಶಿಕ್ಷಣ)|ಅತ್ಯಾಚಾರ|ಕೆಟ್ಟದಾಗಿ\\s*ಮುಟ್ಟ|ಕೆಟ್ಟ\\s*ಸ್ಪರ್ಶ|ಅಸಭ್ಯ(?:ವಾಗಿ)?\\s*(?:ಮುಟ್ಟ|ವರ್ತಿಸ)|ದೌರ್ಜನ್ಯ`,
    false,
  ),
  // A wedding in the village is not a child marriage: the child must be the one married.
  kn(
    "kn_marriage",
    "child_marriage",
    `ಬಾಲ್ಯ\\s*ವಿವಾಹ|ಚಿಕ್ಕ\\s*ವಯಸ್ಸಿ\\S*\\s*ಮದುವೆ|(?:ಹುಡುಗಿ|ಹುಡುಗ|ಮಗು|ಮಗಳ|ಅವಳ|ಅವನ)\\S*\\s+(?:\\S+\\s+){0,3}ಮದುವೆ\\s*ಮಾಡ(?:ಿಸ|ುತ್ತಾರ|್ತಾರ|್ತಿದ್ದಾರ|ುತ್ತಿದ್ದಾರ|ೋಕೆ)`,
    false,
  ),
  // Election duty is not child labour: the child must be the one sent.
  kn(
    "kn_labour",
    "child_labour",
    `ಬಾಲ\\s*ಕಾರ್ಮಿಕ|(?:ಮಗು|ಮಗುವನ್ನ|ಹುಡುಗ|ಹುಡುಗಿ|ಮಕ್ಕಳ|ಅವನನ್ನ|ಅವಳನ್ನ)\\S*\\s+(?:\\S+\\s+){0,3}(?:ಕೆಲಸಕ್ಕೆ|ದುಡಿಮೆಗೆ|ಹೊಲಕ್ಕೆ)\\s*ಕಳಿಸ`,
    false,
  ),
  kn(
    "kn_self_harm",
    "self_harm",
    `(?:ಮಗು|ಹುಡುಗ|ಹುಡುಗಿ|ಅವನು|ಅವಳು)\\S*\\s+(?:\\S+\\s+){0,3}(?:ಸಾಯ್ತೀನಿ|ಸಾಯುತ್ತೇನೆ|ಆತ್ಮಹತ್ಯೆ)|(?:ಸಾಯ್ತೀನಿ|ಸಾಯುತ್ತೇನೆ|ಸಾಯ್ಬೇಕು)\\s*ಅಂತ\\s+(?:\\S+\\s+){0,2}(?:ಮಗು|ಹುಡುಗ|ಹುಡುಗಿ)`,
    false,
  ),
  // Serious neglect (v4). Days without food at home, never the school meal; alone at home at night
  // or for days, never "no one at home to help him read", a daytime absence or "the only son";
  // put out of the house. A punishment question ("can I put him outside?") stays a kind practice.
  kn(
    "kn_neglect_food",
    "neglect",
    `(?:ಎರಡು|ಮೂರು|ನಾಲ್ಕು|ಐದು|ಹಲವು|ಕೆಲವು|ತುಂಬಾ|[0-9೦-೯]+)\\s*ದಿನ\\S*\\s+(?:(?!ಶಾಲೆ|ಸ್ಕೂಲ್|ಬಿಸಿಯೂಟ)\\S+\\s+){0,3}(?:ಊಟ|ಆಹಾರ|ತಿಂಡಿ|ಅನ್ನ)\\S*\\s*(?:\\S+\\s+)?(?:ಕೊಟ್ಟಿಲ್ಲ|ಕೊಡ್ತಿಲ್ಲ|ಕೊಡುತ್ತಿಲ್ಲ|ಕೊಡಲ್ಲ|ಹಾಕಿಲ್ಲ|ಹಾಕ್ತಿಲ್ಲ|ತಿಂದಿಲ್ಲ|ಮಾಡಿಲ್ಲ|ಸಿಕ್ಕಿಲ್ಲ)`,
    false,
  ),
  kn(
    "kn_neglect_alone",
    "neglect",
    `(?:ಮನೆಯಲ್ಲಿ|ಮನೇಲಿ|ಮನೆಲ್ಲಿ)\\s*(?:\\S+\\s+){0,2}(?:ಯಾರೂ\\s*(?:ಇಲ್ಲ|ಇರಲ್ಲ|ಇರೋದಿಲ್ಲ|ಇರುವುದಿಲ್ಲ)|(?:ಒಬ್ಬನೇ|ಒಬ್ಬಳೇ|ಒಬ್ಬನೆ|ಒಬ್ಬಳೆ|ಒಂಟಿಯಾಗಿ)(?!\\s*ಮಗ))(?![^.!?।]{0,40}(?:ಓದಿಸ|ಹೇಳಿಕೊಡ|ಕಲಿಸ|ಹೋಂವರ್ಕ್|ಮನೆಕೆಲಸ|ಸಹಾಯ|ಓದೋಕೆ|ಬರೆಯೋಕೆ))[^.!?।]{0,40}?(?:ರಾತ್ರಿ|ವಾರ|ತಿಂಗಳ|ದಿನ(?:ದಿಂದ|ಗಳಿಂದ|ಗಳ))|(?:ರಾತ್ರಿ|ವಾರ|ತಿಂಗಳ|ದಿನ(?:ದಿಂದ|ಗಳಿಂದ|ಗಳ))\\S*\\s+(?:\\S+\\s+){0,3}(?:ಮನೆಯಲ್ಲಿ|ಮನೇಲಿ|ಮನೆಲ್ಲಿ)\\s*(?:ಯಾರೂ\\s*(?:ಇಲ್ಲ|ಇರಲ್ಲ|ಇರೋದಿಲ್ಲ|ಇರುವುದಿಲ್ಲ)|(?:ಒಬ್ಬನೇ|ಒಬ್ಬಳೇ|ಒಬ್ಬನೆ|ಒಬ್ಬಳೆ|ಒಂಟಿಯಾಗಿ)(?!\\s*ಮಗ))(?![^.!?।]{0,40}(?:ಓದಿಸ|ಹೇಳಿಕೊಡ|ಕಲಿಸ|ಹೋಂವರ್ಕ್|ಮನೆಕೆಲಸ|ಸಹಾಯ|ಓದೋಕೆ|ಬರೆಯೋಕೆ))|ಮನೆಯಿಂದ\\s*(?:ಹೊರಗೆ|ಆಚೆ)\\s*(?:\\S+\\s+)?(?:ಹಾಕ|ಓಡಿಸ|ತಳ್ಳ|ದಬ್ಬ)|(?:ಹೊರಗೆ|ಆಚೆ)\\s*(?:\\S+\\s+)?ಬೀಗ\\s*ಹಾಕ`,
    false,
  ),
  en(
    "en_neglect",
    "neglect",
    `\\b(?:not|never|no|hasn[’']?t|has not|haven[’']?t|have not|hadn[’']?t|had not|wasn[’']?t|was not|isn[’']?t|is not|without)\\s+(?:been\\s+|being\\s+)?(?:fed|food|eaten|eating|given\\s+(?:any\\s+)?food|had\\s+(?:any\\s+)?food|anything to eat)\\b[^.!?]{0,30}?\\b(?:for|in)\\s+(?:(?:two|three|four|five|six|seven|several|many|a few|\\d+)\\s+)?days\\b|\\balone\\s+(?:at home|in the house)\\s+for\\s+(?:(?:a|one|two|three|several|many|\\d+)\\s+)?(?:days?|weeks?|months?|nights?)\\b|\\b(?:left|leaves|leave)\\s+(?:him|her|them|the (?:child|boy|girl|children|kids))\\s+alone\\s+(?:at home|in the house|for\\s+(?:days|weeks|nights))\\b|\\b(?:was|is|been|being|gets?|got)\\s+left\\s+alone\\s+(?:at home|in the house|for\\s+(?:days|weeks|nights))\\b|\\b(?:locks?|locked|shuts?|shut|throws?|threw|thrown|kicks?|kicked)\\s+(?:him|her|them|the (?:child|boy|girl))\\s+out(?:side)?\\s+(?:of\\s+(?:the\\s+)?(?:house|home)|at night)\\b`,
    false,
  ),
  hi(
    "hi_neglect",
    "neglect",
    `(?:दो|तीन|चार|पांच|पाँच|कई|[0-9]+)\\s+दिन(?:ों)?\\s+से\\s+(?:\\S+\\s+){0,3}(?:खाना|भोजन)\\s+(?:\\S+\\s+){0,2}(?:नहीं|न)\\s+(?:मिला|दिया|खाया|खिलाया)|घर (?:में|पर) अकेल\\S*\\s+(?:\\S+\\s+){0,2}छोड़|घर से (?:बाहर )?निकाल`,
    false,
  ),
  // English. "teacher" alone is left out: "should a teacher beat children?" is a question, not a report.
  en(
    "en_home_violence",
    "violence_at_home",
    `\\b(?:beats?|beaten|hits?|burns?|burned|locks?)\\s+(?:him|her|them)\\s+(?:up\\s+)?at home\\b|\\b(?:father|mother|uncle|stepfather|parents?|brother|grandfather|papa)\\s+(?:\\w+\\s+){0,3}(?:beats?|hits?|burns?|burned|kicks?)\\s+(?:him|her|them)\\b|\\bbeaten at home\\b`,
    false,
  ),
  en(
    "en_school_violence",
    "violence_at_school",
    `\\b(?:headmaster|headmistress|head teacher|principal|another teacher|the other teacher|a colleague|hm)\\b[^.!?]{0,30}\\b(?:canes?|caned|beats?|beat|hits?|slaps?|slapped)\\s+(?:the\\s+)?(?:children|kids|students|pupils|him|her|them)\\b`,
    false,
  ),
  en(
    "en_abuse",
    "abuse",
    `\\b(?:uncle|father|stepfather|neighbou?r|brother|cousin|man|men|relative)\\s+(?:\\w+\\s+)?touch(?:es|ed|ing)?\\s+(?:her|him|them|me)\\b|\\btouch(?:es|ed|ing)?\\s+(?:her|him|them)\\s+(?:inappropriately|badly|wrongly)\\b|\\b(?:sexual(?:ly)?\\s+abus\\w*|molest\\w*|rape\\w*|child abuse)\\b`,
    false,
  ),
  en(
    "en_injury",
    "injury",
    `\\b(?:bruises?|burn marks?|cuts? on (?:his|her) (?:arms?|legs?|body))\\b(?!\\s+from\\s+(?:playing|kabaddi|football|cricket|games?|sports?|a fall|falling))`,
    false,
  ),
  en("en_marriage", "child_marriage", `\\b(?:child marriage|marry (?:her|him) off|married off|getting her married)\\b`, false),
  en("en_labour", "child_labour", `\\b(?:child labou?r|(?:he|she|the child|the boy|the girl)\\s+(?:is|was)\\s+sent (?:off )?to work|sent\\s+(?:him|her|the child|the boy|the girl)\\s+(?:off\\s+)?to work|works? in (?:the )?(?:fields|a shop|a hotel|a factory) instead of)\\b`, false),
  en(
    "en_self_harm",
    "self_harm",
    `\\b(?:he|she|the child|the boy|the girl)\\s+(?:said|says|told me|wants)\\s+(?:\\w+\\s+){0,3}(?:to die|kill (?:himself|herself)|suicide)\\b|\\b(?:student|child|boy|girl|pupil)\\b[^.!?]{0,30}\\b(?:tried to kill (?:himself|herself)|wants? to (?:die|kill (?:himself|herself))|cut (?:himself|herself)|harm(?:s|ed)? (?:himself|herself))`,
    false,
  ),
  // Romanised and code mixed (speech to text and typing on English keyboards).
  en(
    "rom_home_violence",
    "violence_at_home",
    `\\b(?:papa|pita|appa|amma|father|mother|uncle|chacha|mama)\\b[^.!?]{0,40}\\b(?:maarte|maarta|maarti|peette|peetta|peetti|hodeyuttare|hodithare|hodeetare|hodithaare|hodiyuttare|hodeyutare)\\b|\\bmane\\s*(?:alli|li)\\b[^.!?]{0,30}\\bhod\\w*`,
    false,
  ),
  en(
    "mix_home_violence",
    "violence_at_home",
    `(?:ಮನೆಯಲ್ಲಿ|ಮನೇಲಿ|ಅಪ್ಪ|\\b(?:father|uncle|mother|papa))[^.!?।]{0,40}\\b(?:beat|hit|slap|punish)\\w*\\s*(?:ಮಾಡ|ಕೊಡ)`,
    false,
  ),
  // Hindi.
  hi(
    "hi_home_violence",
    "violence_at_home",
    `(?:घर (?:पर|में)|पापा|पिता|पिताजी|माँ|मां|मम्मी|चाचा|मामा|सौतेले)\\S*\\s+(?:\\S+\\s+){0,5}(?:मारते|पीटते|मारता|पीटता|मारती|पीटती)|शराब पीकर\\s+(?:\\S+\\s+){0,2}(?:मारते|पीटते|मारता|पीटता)`,
    false,
  ),
  hi("hi_abuse", "abuse", `यौन(?! शिक्षा)|बलात्कार|छेड़छाड़|छेड़खानी|गलत (?:तरीके से|ढंग से) (?:छूता|छूते|छूती|छुआ)`, false),
  hi("hi_marriage", "child_marriage", `बाल विवाह|(?:उसकी|उसका|बच्ची की|लड़की की|बच्चे की)\\s+(?:\\S+\\s+){0,2}शादी (?:कर रहे|करवा रहे|करने वाले|कराने वाले)`, false),
  hi("hi_labour", "child_labour", `बाल मजदूरी|बाल मज़दूरी|(?:बच्चे|बच्ची|बच्चा|लड़के|लड़की|उसे|उसको)\\s+(?:\\S+\\s+){0,3}काम पर भेज`, false),
  hi("hi_injury", "injury", `जलने के निशान|चोट के निशान|मार के निशान`, false),
  hi("hi_self_harm", "self_harm", `(?:बच्चा|बच्ची|लड़का|लड़की|वह)\\s+(?:\\S+\\s+){0,3}(?:मरना चाहता|मरना चाहती|आत्महत्या)`, false),
];

// ── Negation ────────────────────────────────────────────────────────────────
// Only explicit prohibitions and denials count. Anything doubtful stays a hit (the safe side).

const KN_LETTER = new RegExp(`[${K}]`, "u");
const KN_CONSONANT_END = /[\u0C95-\u0CB9]$/u;
/** In the same word: ಹೊಡೆಯಬೇಡಿ, ಹೊಡೆಯಬಾರದು, ಹೊಡೆಯದಿರಿ. */
const KN_PROHIBIT_IN_WORD = /ಬೇಡ|ಬಾರ[ದ್]|ಕೂಡ[ದ್]|ದಿರಿ/u;
/** At the end of the word: ಹೊಡೆಯಲ್ಲ, ಹೊಡೆಯಲಿಲ್ಲ, ಬೈಯೋದಲ್ಲ. Not ಲ್ಲಿ, the locative. */
const KN_DENIAL_END = /(?:ಲ್ಲ|ಲ್ಲಾ)$/u;
/** The next word: ಬೇಡ, ಅನ್ನಬೇಡಿ, ಬದಲು (instead of), ಆಗದಂತೆ (so that it does not happen). */
const KN_NEXT_NEGATES = /^(?:\S*(?:ಬೇಡ|ಬಾರದ|ಬಾರ್ದ|ಕೂಡದ)\S*|ಬದಲು\S*|ಬದಲಿಗೆ|\S*[\u0C95-\u0CB9]ದಂತೆ)(?=$|[\s.,!?।])/u;
/** ಇಲ್ಲ after it, unless it starts a condition: ಬೆತ್ತ ಇಲ್ಲ ಅಂದ್ರೆ (if there is no cane...). */
const KN_NEXT_ILLA = /^ಇಲ್ಲಾ?(?=$|[\s.,!?।])/u;
const KN_CONDITIONAL = /^(?:ಅಂದ್ರೆ|ಅಂದರೆ|ಅಂದ್ರ|ಆದ್ರೆ|ಆದರೆ|ಅಂತ|ಅಂತಾ)/u;
/** A second negative undoes the first: ಹೊಡೆಯದೆ ಇರೋಕೆ ಆಗಲ್ಲ (one cannot do without hitting). */
const KN_SECOND_NEGATIVE = /(?:ಆಗಲ್ಲ|ಆಗೋದಿಲ್ಲ|ಆಗುವುದಿಲ್ಲ|ಸಾಧ್ಯವಿಲ್ಲ|ಕೇಳಲ್ಲ|ಕೇಳೋದಿಲ್ಲ|ಕಲಿಯಲ್ಲ|ಕಲೀಲ್ಲ|ಕಲಿಯೋದಿಲ್ಲ|ಬರಲ್ಲ|ಕೆಲಸ\s*ಮಾಡಲ್ಲ)/u;

// English: a negator right before the harm, with at most two plain adverbs between. "Never hit",
// "do not ever hit"; not "it is not wrong to hit", "do not hesitate to hit", "if he does not read
// hit him".
// Hindi: the negator comes right before the verb (मत मारो, कभी न मारें, बिना डांटे) or नहीं right
// after (मारना नहीं), but not "नहीं तो" (otherwise).
const HI_LETTER = new RegExp(`[${D}]`, "u");
const HI_NEGATION_BEFORE = /(?:^|\s)(?:मत|न|ना|नहीं|बिना)\s+$/u;
const HI_NEGATION_AFTER = /^(?:\S*\s+)?(?:नहीं|मत)(?!\s+(?:तो|छोड़|छोड|बंद|रोक))(?=$|[\s.,!?।])/u;
/** "If we don't hit, he won't listen": a then-clause makes the negation a condition, not advice. */
const HI_CONDITION_AFTER = /^(?:\S+\s+){0,3}तो(?=$|[\s.,!?।])/u;

// One negator also covers a list of harms that ends in "or", "and" or "nor": "never hit, scare or
// shame". A list ending in a comma does not ("do not hit, shame him"), so the doubtful case stays a hit (v3).
const EN_HARM_VERB =
  "(?:hit|beat|slap|smack|cane|spank|pinch|punish|scare|frighten|threaten|shame|humiliate|mock|insult|scold|shout|yell|label|compare)\\w*";
const EN_NEGATION_BEFORE = new RegExp(
  `\\b(?:never|don[’']?t|do not|didn[’']?t|did not|without|avoid|stop|instead of|no|not)\\s+(?:(?:ever|even|really|physically|harshly|once)\\s+){0,2}(?:(?:${EN_HARM_VERB}\\s*,\\s*){0,3}${EN_HARM_VERB}\\s+(?:or|and|nor)\\s+)?$`,
  "i",
);

function knWithoutForm(match: string, rest: string): boolean {
  // ಹೊಡೆ + ಯದೆ, ಬೈಯ + ದೆ, ಹೆದರಿಸ + ದಂತೆ: "without" or "so as not to".
  return KN_CONSONANT_END.test(match) ? /^ದ(?:ೆ|ಂತೆ|ಿರ)/u.test(rest) : /^ಯದ(?:ೆ|ಂತೆ|ಿರ)/u.test(rest);
}

/** "If you don't hit them, they won't learn": a negation inside an if clause is a condition. */
const EN_CONDITIONAL = /\b(?:if|unless)\b[^.,;!?]*$/i;
/** "Don't stop hitting them": two negatives in a row cancel. */
const EN_DOUBLE_NEGATIVE = /\b(?:never|don[’']?t|do not|didn[’']?t|did not|not)\s+(?:stop|avoid|quit)\s+$/i;

function isNegated(text: string, start: number, end: number, script: "kn" | "hi" | "en"): boolean {
  if (script === "en") {
    const before = text.slice(Math.max(0, start - 60), start);
    return EN_NEGATION_BEFORE.test(before) && !EN_CONDITIONAL.test(before) && !EN_DOUBLE_NEGATIVE.test(before);
  }
  if (script === "hi") {
    const rest = /^\S*/u.exec(text.slice(end))?.[0] ?? "";
    const after = text.slice(end + rest.length).trimStart();
    if (HI_CONDITION_AFTER.test(after)) return false;
    return HI_NEGATION_BEFORE.test(text.slice(Math.max(0, start - 20), start)) || HI_NEGATION_AFTER.test(after);
  }
  const match = text.slice(start, end);
  const rest = /^\S*/u.exec(text.slice(end))?.[0] ?? "";
  const after = text.slice(end + rest.length).trimStart();
  const next = after.split(/\s+/).slice(0, 3);
  const secondNegative = KN_SECOND_NEGATIVE.test(next.slice(0, 3).join(" "));
  if (KN_PROHIBIT_IN_WORD.test(rest)) return true;
  // "By hitting, children do not learn" (ಹೊಡೆಯೋದ್ರಿಂದ ಮಕ್ಕಳು ಕಲೀಲ್ಲ) argues against the harm.
  if (/(?:ರಿಂದ|ದಿಂದ)$/u.test(rest) && secondNegative) return true;
  if (KN_DENIAL_END.test(rest.replace(/[.,!?।]+$/u, ""))) return !secondNegative;
  if (knWithoutForm(match, rest)) return !secondNegative;
  if (KN_NEXT_NEGATES.test(after)) return true;
  if (KN_NEXT_ILLA.test(after)) return !KN_CONDITIONAL.test(next[1] ?? "");
  return false;
}

/** NFC and no zero width characters or soft hyphens, so a split or decomposed word still matches. */
export function cleanForScan(text: string): string {
  return text.normalize("NFC").replace(/[\u200B-\u200D\u2060\u00AD\uFEFF]/g, "");
}

export type PatternHit<C extends string> = { category: C; id: string; negated: boolean };

function scan<C extends string>(patterns: Pattern<C>[], raw: string): PatternHit<C>[] {
  const text = cleanForScan(raw);
  const hits: PatternHit<C>[] = [];
  for (const p of patterns) {
    p.re.lastIndex = 0;
    for (const m of text.matchAll(p.re)) {
      const start = m.index ?? 0;
      const script = KN_LETTER.test(m[0]) ? "kn" : HI_LETTER.test(m[0]) ? "hi" : "en";
      const negated = p.negatable && isNegated(text, start, start + m[0].length, script);
      hits.push({ category: p.category, id: p.id, negated });
    }
  }
  return hits;
}

/** Every unsafe pattern hit, with whether a negation turned it into advice against the harm. */
export function scanUnsafe(text: string): PatternHit<UnsafeCategory>[] {
  return scan(UNSAFE_PATTERNS, text);
}

/** Categories of harm the text advises or describes, ignoring negated mentions ("never hit"). */
export function findUnsafe(text: string): UnsafeCategory[] {
  return [...new Set(scanUnsafe(text).filter((h) => !h.negated).map((h) => h.category))];
}

/**
 * What a teacher's question discloses about harm to a child, as safety flags. Empty, or
 * `child_harm` plus the specific kinds. Teacher distress is never here (it is not a Childline case).
 */
export function findDisclosures(text: string): string[] {
  const kinds = [...new Set(scan(DISCLOSURE_PATTERNS, text).map((h) => h.category))];
  return kinds.length ? ["child_harm", ...kinds] : [];
}

// A teacher saying they want to die or end their life (Tele-MANAS, never pedagogy). Kept apart
// from the softer distress words ("I can't cope"), which only add a flag.
const TEACHER_CRISIS: Pattern<"teacher_crisis">[] = [
  en("en_crisis", "teacher_crisis", `\\b(?:i (?:want to|wanna) die|kill myself|end my life|i feel like dying|i don[’']?t want to live)\\b`, false),
  kn("kn_crisis", "teacher_crisis", `ಸಾಯಬೇಕು\\s*ಅನ್ಸ|ಬದುಕೋದು\\s*ಸಾಕು|ಬದುಕಿರೋಕೆ\\s*ಇಷ್ಟ\\s*ಇಲ್ಲ|ಆತ್ಮಹತ್ಯೆ\\s*ಮಾಡ್ಕೊಳ್ಳ`, false),
  hi("hi_crisis", "teacher_crisis", `मरना चाह(?:ती|ता) (?:हूँ|हूं)|जीना नहीं चाह(?:ती|ता)|आत्महत्या कर लूं|आत्महत्या कर लूँ`, false),
];

export function findTeacherCrisis(text: string): boolean {
  return scan(TEACHER_CRISIS, text).length > 0;
}

/** Child welfare or teacher distress signals (for triage and reviewer flags, never silence). */
export function findWelfareSignals(text: string): WelfareCategory[] {
  return [...new Set(scan(WELFARE_PATTERNS, text).map((h) => h.category))];
}
