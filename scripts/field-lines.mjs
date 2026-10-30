// The field test in sentences, built only from video/numbers.json (which scripts/field-numbers.mjs
// fills from the database). README, docs/SUBMISSION.md and the deck all say the field story with
// these words, so no field statement is ever a fixed sentence that goes stale (Law 7).
//
// A hidden number (fewer than 5 different teachers behind it) is never written as a number,
// exactly as /how keeps it.

const v = (nums, key) => nums[key]?.value ?? null;
const hidden = (nums, key) => nums[key]?.hidden === true;

/** "30 Oct" from an ISO date, in India time. */
export function day(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export function fieldLines(nums) {
  const teachers = v(nums, "teachers");
  const firstJoin = v(nums, "first_join_day");
  const firstQuestion = v(nums, "first_question_day");
  const q = v(nums, "questions");
  const answered = v(nums, "answered_from_cards");
  const toPerson = v(nums, "sent_to_person");
  const tried = v(nums, "tried");
  const worked = v(nums, "worked");

  const joined =
    teachers > 0
      ? `From ${firstJoin}, his colleagues joined on their own phones through a link the headmaster forwarded on WhatsApp: ${teachers} teachers so far.`
      : "No field teacher has joined yet.";

  let asked;
  if (hidden(nums, "questions"))
    asked = `They began asking real questions in Kannada on ${firstQuestion}. How many, and how each was answered, stay private until 5 different teachers have asked, as /how keeps them.`;
  else if (q > 0)
    asked = `They have asked ${q} real questions since ${firstQuestion}: ${answered} answered from his approved cards, ${toPerson} sent to a person.`;
  else asked = "No field teacher has asked a question yet.";

  let outcome;
  if (hidden(nums, "tried"))
    outcome =
      "What teachers said after trying an answer stays private until 5 of them have told us.";
  else if (tried > 0)
    outcome = `After trying an answer, teachers said it worked ${worked} of ${tried} times.`;
  else outcome = "No field teacher has told us yet whether an answer worked.";

  // One short line for a slide's "limits" row.
  const limit =
    hidden(nums, "questions") || q > 0
      ? tried > 0 || hidden(nums, "tried")
        ? "Field use is days old"
        : "No field teacher has reported back after trying an answer yet"
      : "No field teacher has asked a question yet";

  // The deck's headline claim about testing with real teachers.
  let claim;
  if (hidden(nums, "questions"))
    claim = "Real teachers have begun asking. Counts under 5 teachers stay private by design.";
  else if (q > 0) claim = `Real teachers are asking: ${q} questions so far.`;
  else claim = "No field teacher has asked yet, so we claim no teacher testing.";

  return { joined, asked, outcome, limit, claim };
}
