# Answerer: Sonnet or Haiku

The same 6 answer cases (evals/answerer.jsonl, all Sample) answered by claude-sonnet-5-5 and claude-haiku-5-5, each checked by the same grounding judges and final safety reading, from recordings (no new calls when this page is rewritten). Grounding is guaranteed either way: only steps the judge supports ship. What differs is how many steps survive, how the Kannada reads, the time and the cost. The founder reads the Kannada and decides.

- claude-sonnet-5-5: 6 of 6 shipped, 25 of 25 drafted steps kept by the judge, answer median 5.8 s, mean cost $0.01442 per question
- claude-haiku-5-5: 5 of 6 shipped, 21 of 24 drafted steps kept by the judge, answer median 4.4 s, mean cost $0.00199 per question

## answer-01-kn-letters

Question (kn): ಒಂದು ಮಗು ಇನ್ನೂ ಅಕ್ಷರ ಗುರುತು ಹಿಡಿಯಲ್ಲ, ಏನು ಮಾಡ್ಲಿ?

**Sonnet** (claude-sonnet-5-5): shipped; 5 of 5 steps kept; answer 5.8 s, checking 3.4 s; cost $0.01769

- ಶೀರ್ಷಿಕೆ / Title: ಮರಳಲ್ಲಿ ದಿನಕ್ಕೊಂದು ಅಕ್ಷರ / One letter in sand
- 1. ಎಲ್ಲಾ ಅಕ್ಷರ ಒಟ್ಟಿಗೆ ಬೇಡ, ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ ಕಲಿಸಿ.  
  Do not teach all letters together. Teach just one letter a day.  
  _kept, card sample-card-01_
- 2. ತಟ್ಟೆಯಲ್ಲಿ ಮರಳು ಹಾಕಿ, ಮಗು ಬೆರಳಿಂದ ಬರೆಯುತ್ತಾ ಜೋರಾಗಿ ಹೇಳಲಿ.  
  Put sand in a plate; the child writes with a finger, saying the letter aloud.  
  _kept, card sample-card-01_
- 3. ಮೊದಲ ಹದಿನೈದು ದಿನ, ಪ್ರಾರ್ಥನೆ ಆದ ಮೇಲೆ ಹತ್ತು ನಿಮಿಷ ಮಾಡಿ.  
  For the first fifteen days, do it ten minutes after the morning prayer.  
  _kept, card sample-card-01_
- 4. ಮರೆತರೆ ಬೈಯಬೇಡಿ, ಮರುದಿನ ಅದೇ ಅಕ್ಷರ ಮತ್ತೆ ಮರಳಲ್ಲಿ ಬರೆಸಿ.  
  If the child forgets, do not scold; repeat the same letter in sand next day.  
  _kept, card sample-card-01_
- 5. ಮೂರು ದಿನ ಸತತ ಗುರುತಿಸಿದರೆ ಮುಂದಿನ ಅಕ್ಷರಕ್ಕೆ ಹೋಗಿ.  
  When the child knows it three days in a row, move to the next letter.  
  _kept, card sample-card-01_
- ಏಕೆ / Why: ಒಂದೇ ಅಕ್ಷರ ಗಟ್ಟಿಯಾದ ಮೇಲೆ ಮುಂದೆ ಹೋಗುವುದು. / One letter at a time, moving on only when it is firm.

**Haiku** (claude-haiku-5-5): shipped; 4 of 5 steps kept; answer 3.9 s, checking 2.0 s; cost $0.00212

- ಶೀರ್ಷಿಕೆ / Title: ಮರಳಲ್ಲಿ ದಿನಕ್ಕೊಂದು ಅಕ್ಷರ / One letter a day in sand
- 1. ಎಲ್ಲಾ ಅಕ್ಷರ ಒಟ್ಟಿಗೆ ಕಲಿಸೋದು ಬಿಡಿ. ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ ಆಯ್ಕೆ ಮಾಡಿ.  
  Stop teaching all letters together. Pick just one letter a day.  
  _removed: not supported, card sample-card-01_
- 2. ಒಂದು ತಟ್ಟೆಯಲ್ಲಿ ಮರಳು ಹಾಕಿ. ಮಗು ಬೆರಳಿಂದ ಅಕ್ಷರ ಬರೆದು ಜೋರಾಗಿ ಹೇಳಲಿ.  
  Spread sand in a plate. Let the child write the letter with a finger, saying it aloud.  
  _kept, card sample-card-01_
- 3. ಮೊದಲ ಹದಿನೈದು ದಿನ, ಪ್ರಾರ್ಥನೆ ಆದ ಮೇಲೆ ದಿನಕ್ಕೆ ಹತ್ತು ನಿಮಿಷ ಮಾಡಿ.  
  For the first fifteen days, do this for ten minutes after morning prayer.  
  _kept, card sample-card-01_
- 4. ಮರೆತರೆ ಬೈಯಬೇಡಿ. ಮರುದಿನ ಅದೇ ಅಕ್ಷರ ಮತ್ತೆ ಮರಳಲ್ಲಿ ಬರೆಸಿ.  
  If the child forgets, do not scold. Repeat the same letter in the sand the next day.  
  _kept, card sample-card-01_
- 5. ಮೂರು ದಿನ ಸತತ ಗುರುತಿಸಿದರೆ ಮುಂದಿನ ಅಕ್ಷರಕ್ಕೆ ಹೋಗಿ.  
  When the child knows it three days in a row, move to the next letter.  
  _kept, card sample-card-01_
- ಏಕೆ / Why: ಒಂದೇ ಅಕ್ಷರ ಗಟ್ಟಿಯಾದ ಮೇಲೆ ಮುಂದೆ ಹೋಗೋದು. / One letter at a time, moving on only when it is firm.

## answer-02-en-number-sense

Question (en): My Class 2 children count to a hundred but don't understand what fourteen means.

**Sonnet** (claude-sonnet-5-5): shipped; 5 of 5 steps kept; answer 8.2 s, checking 2.3 s; cost $0.01742

- ಶೀರ್ಷಿಕೆ / Title: ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು-ಬಿಡಿ / Tens and ones with bundles
- 1. ಮಕ್ಕಳೇ ಬೆಂಕಿ ಕಡ್ಡಿ, ಐಸ್ಕ್ರೀಮ್ ಕಡ್ಡಿ ಸಂಗ್ರಹಿಸಲಿ; ಪ್ರತಿ ಮಗುವಿಗೂ ಒಂದು ಡಬ್ಬಿ.  
  Let children collect sticks themselves, with one small box for each child.  
  _kept, card sample-card-02_
- 2. ಹತ್ತು ಕಡ್ಡಿ ಆದ ತಕ್ಷಣ ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಕಟ್ಟು ಮಾಡಿಸಿ, 'ಇದು ಒಂದು ಹತ್ತು' ಅನ್ನಿಸಿ.  
  At ten sticks, have them band a bundle and say, 'This is one ten.'  
  _kept, card sample-card-02_
- 3. ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಒಂದು ಕಟ್ಟು, ನಾಲ್ಕು ಬಿಡಿ ಕಡ್ಡಿ; ಮಕ್ಕಳೇ ಮಾಡಿ ತೋರಿಸಲಿ.  
  Fourteen is one bundle and four loose sticks; let children make it and show you.  
  _kept, card sample-card-02_
- 4. ಇಬ್ಬರಿಬ್ಬರ ಜೋಡಿ ಮಾಡಿ: ಒಬ್ಬರು ಎಣಿಸಲಿ, ಇನ್ನೊಬ್ಬರು ಕಟ್ಟಲಿ.  
  Make pairs: one counts, the other ties.  
  _kept, card sample-card-02_
- 5. ನೆಲದ ಮೇಲೆ ಸೀಮೆಸುಣ್ಣದಲ್ಲಿ ಹತ್ತರ ಮನೆ, ಬಿಡಿ ಮನೆ ಬರೆಯಿರಿ.  
  Draw a tens house and a ones house on the floor with chalk.  
  _kept, card sample-card-02_
- ಏಕೆ / Why: ಸಂಖ್ಯೆ ಕೈಯಲ್ಲಿ ಹಿಡಿಯೋ ಹಾಗೆ ಆದಾಗ ಮಗುವಿಗೆ ಅದರ ಅರ್ಥ ಕಾಣುತ್ತೆ. / When a number becomes something children can hold, they see what it means.

**Haiku** (claude-haiku-5-5): shipped; 4 of 4 steps kept; answer 4.4 s, checking 2.4 s; cost $0.00195

- ಶೀರ್ಷಿಕೆ / Title: ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ / Tens and ones with stick bundles
- 1. ಮಕ್ಕಳೇ ಬೆಂಕಿ ಕಡ್ಡಿ ಅಥವಾ ಐಸ್ಕ್ರೀಮ್ ಕಡ್ಡಿ ಸಂಗ್ರಹಿಸಿ, ಪ್ರತಿ ಮಗುವಿಗೂ ಒಂದು ಡಬ್ಬಿ ಕೊಡಿ.  
  Let children collect matchsticks or ice cream sticks, one small box for each child.  
  _kept, card sample-card-02_
- 2. ಹತ್ತು ಕಡ್ಡಿ ಆದಾಗ ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಕಟ್ಟು ಮಾಡಿಸಿ, 'ಇದು ಒಂದು ಹತ್ತು' ಎಂದು ಹೇಳಿಸಿ.  
  When there are ten sticks, have them tie a rubber band round them and say, 'This is one ten.'  
  _kept, card sample-card-02_
- 3. ಹದಿನಾಲ್ಕು ಅಂದರೆ ಒಂದು ಕಟ್ಟು ಮತ್ತು ನಾಲ್ಕು ಬಿಡಿ ಕಡ್ಡಿ; ಮಕ್ಕಳೇ ಮಾಡಿ ತೋರಿಸಲಿ.  
  Fourteen is one bundle and four loose sticks; let the children make it and show you.  
  _kept, card sample-card-02_
- 4. ನೆಲದ ಮೇಲೆ ಸೀಮೆಸುಣ್ಣದಲ್ಲಿ ಹತ್ತರ ಮನೆ ಮತ್ತು ಬಿಡಿ ಮನೆ ಬರೆಯಿರಿ.  
  Draw a tens house and a ones house on the floor with chalk.  
  _kept, card sample-card-02_
- ಏಕೆ / Why: ಸಂಖ್ಯೆ ಕೈಯಲ್ಲಿ ಹಿಡಿಯುವ ಹಾಗೆ ಆದಾಗ ಮಗುವಿಗೆ ಅದರ ಅರ್ಥ ಕಾಣುತ್ತದೆ. / When a number becomes something children can hold, they see what it means.

## answer-03-hi-number-sense

Question (hi): मेरी कक्षा 1 में बच्चे गिनती रट लेते हैं पर 14 का मतलब नहीं समझते। क्या करूँ?

**Sonnet** (claude-sonnet-5-5): shipped; 5 of 5 steps kept; answer 10.1 s, checking 2.2 s; cost $0.02115

- ಶೀರ್ಷಿಕೆ / Title: ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ / Tens and ones with sticks
- 1. ಮಕ್ಕಳೇ ಬೆಂಕಿ ಕಡ್ಡಿ ಅಥವಾ ಐಸ್ಕ್ರೀಮ್ ಕಡ್ಡಿ ಸಂಗ್ರಹಿಸಲಿ, ಪ್ರತಿ ಮಗುವಿಗೂ ಒಂದು ಡಬ್ಬಿ.  
  Let the children collect sticks themselves, with one small box for each child.  
  _kept, card sample-card-02_
- 2. ಹತ್ತು ಕಡ್ಡಿ ಆದ ತಕ್ಷಣ ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಕಟ್ಟು ಮಾಡಿಸಿ, 'ಇದು ಒಂದು ಹತ್ತು' ಅನ್ನಿಸಿ.  
  At ten sticks, have them put a rubber band round and say, 'This is one ten.'  
  _kept, card sample-card-02_
- 3. ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಒಂದು ಕಟ್ಟು, ನಾಲ್ಕು ಬಿಡಿ ಕಡ್ಡಿ; ಮಕ್ಕಳೇ ಮಾಡಿ ತೋರಿಸಲಿ.  
  Fourteen is one bundle and four loose sticks; let the children make it and show you.  
  _kept, card sample-card-02_
- 4. ಇಬ್ಬರಿಬ್ಬರನ್ನು ಜೋಡಿ ಮಾಡಿ: ಒಬ್ಬರು ಎಣಿಸಲಿ, ಇನ್ನೊಬ್ಬರು ಕಟ್ಟಲಿ.  
  Put them in pairs: one counts, the other ties.  
  _kept, card sample-card-02_
- 5. ನೆಲದ ಮೇಲೆ ಸೀಮೆಸುಣ್ಣದಲ್ಲಿ ಹತ್ತರ ಮನೆ ಮತ್ತು ಬಿಡಿ ಮನೆ ಬರೆಯಿರಿ.  
  Draw a tens house and a ones house on the floor with chalk.  
  _kept, card sample-card-02_
- ಏಕೆ / Why: ಸಂಖ್ಯೆ ಕೈಯಲ್ಲಿ ಹಿಡಿಯೋ ಹಾಗೆ ಆದಾಗ ಮಗುವಿಗೆ ಅದರ ಅರ್ಥ ಕಾಣುತ್ತೆ. / When a number becomes something children can hold, they see what it means.

**Haiku** (claude-haiku-5-5): shipped; 5 of 5 steps kept; answer 6.6 s, checking 3.3 s; cost $0.00255

- ಶೀರ್ಷಿಕೆ / Title: ಕಡ್ಡಿ ಕಟ್ಟಿನಿಂದ ಹತ್ತು ಮತ್ತು ಬಿಡಿ / Tens and ones with stick bundles
- 1. ಮಕ್ಕಳೇ ಬೆಂಕಿ ಕಡ್ಡಿ ಅಥವಾ ಐಸ್ಕ್ರೀಮ್ ಕಡ್ಡಿ ಸಂಗ್ರಹಿಸಲಿ; ಪ್ರತಿ ಮಗುವಿಗೆ ಒಂದು ಡಬ್ಬಿ.  
  Let children collect matchsticks or ice cream sticks themselves, one small box each.  
  _kept, card sample-card-02_
- 2. ಹತ್ತು ಕಡ್ಡಿ ಆದಾಗ ರಬ್ಬರ್ ಬ್ಯಾಂಡ್ ಹಾಕಿ ಕಟ್ಟು ಮಾಡಿ, 'ಇದು ಒಂದು ಹತ್ತು' ಎಂದು ಹೇಳಿಸಿ.  
  When there are ten sticks, tie them with a rubber band and have them say, 'This is one ten.'  
  _kept, card sample-card-02_
- 3. ಹದಿನಾಲ್ಕು ಅಂದ್ರೆ ಒಂದು ಕಟ್ಟು ಮತ್ತು ನಾಲ್ಕು ಬಿಡಿ ಕಡ್ಡಿ; ಮಕ್ಕಳೇ ಮಾಡಿ ತೋರಿಸಲಿ.  
  Fourteen is one bundle and four loose sticks; let the children make it and show you.  
  _kept, card sample-card-02_
- 4. ಮಕ್ಕಳನ್ನು ಜೋಡಿ ಮಾಡಿ: ಒಬ್ಬರು ಎಣಿಸಲಿ, ಇನ್ನೊಬ್ಬರು ಕಟ್ಟಲಿ.  
  Pair the children: one counts, the other ties.  
  _kept, card sample-card-02_
- 5. ನೆಲದ ಮೇಲೆ ಸೀಮೆಸುಣ್ಣದಲ್ಲಿ ಹತ್ತರ ಮನೆ ಮತ್ತು ಬಿಡಿ ಮನೆ ಬರೆಯಿರಿ.  
  Draw a tens house and a ones house on the floor with chalk.  
  _kept, card sample-card-02_
- ಏಕೆ / Why: ಸಂಖ್ಯೆ ಕೈಯಲ್ಲಿ ಹಿಡಿಯೋ ಹಾಗೆ ಆದಾಗ ಮಗುವಿಗೆ ಅದರ ಅರ್ಥ ಕಾಣುತ್ತೆ. / When a number becomes something children can hold, they see what it means.

## answer-04-two-cards

Question (kn): ಒಂದು ಮತ್ತು ಎರಡನೇ ತರಗತಿ ಒಟ್ಟಿಗೆ ಇದೆ, ಕೆಲವು ಮಕ್ಕಳಿಗೆ ಇನ್ನೂ ಓದೋಕೆ ಬರಲ್ಲ.

**Sonnet** (claude-sonnet-5-5): shipped; 5 of 5 steps kept; answer 6.1 s, checking 4.7 s; cost $0.01553

- ಶೀರ್ಷಿಕೆ / Title: ಓದುವ ಮಟ್ಟದ ಗುಂಪುಗಳು / Reading level groups
- 1. ತರಗತಿ ನೋಡಿ ಅಲ್ಲ, ಓದೋ ಮಟ್ಟ ನೋಡಿ ಮೂರು ಗುಂಪು ಮಾಡಿ.  
  Make three groups by reading level, not by class.  
  _kept, card sample-card-03_
- 2. ಒಂದು ಗುಂಪಿನ ಜೊತೆ ಕೂರುವ ಮೊದಲೇ ಉಳಿದ ಎರಡಕ್ಕೆ ಕೆಲಸ ಕೊಡಿ.  
  Before you sit with one group, give the other two their work.  
  _kept, card sample-card-03_
- 3. ಒಂದು ಗುಂಪಿಗೆ ಹದಿನೈದು ನಿಮಿಷ, ಸಣ್ಣ ಗಂಟೆ ಹೊಡೆದಾಗ ಗುಂಪು ಬದಲಾಯಿಸಿ.  
  Give each group fifteen minutes, and switch when a small bell rings.  
  _kept, card sample-card-03_
- 4. ಓದಲು ಕಲಿಯುತ್ತಿರುವ ಗುಂಪಿಗೆ ಮರ, ಮನೆ, ಕಲ ಎಂಬ ಎರಡಕ್ಷರದ ಪದ ಕೊಡಿ.  
  Give the beginner group two letter words: ಮರ, ಮನೆ, ಕಲ.  
  _kept, card sample-card-06_
- 5. ಬೆರಳು ಜಾರಿಸುತ್ತಾ 'ಮ... ರ... ಮರ' ಅಂತ ಎಳೆದು ಹೇಳಿಸಿ.  
  Slide a finger along and have them stretch it: 'ಮ... ರ... ಮರ'.  
  _kept, card sample-card-06_
- ಏಕೆ / Why: ಪ್ರತಿ ಮಗು ತನ್ನ ಮಟ್ಟಕ್ಕೆ ತಕ್ಕ ಕೆಲಸ ಮಾಡುತ್ತೆ, ಯಾವ ಗುಂಪೂ ಕಾಯ್ತಾ ಕೂರಲ್ಲ. / Each child works at their own level, and no group sits waiting.

**Haiku** (claude-haiku-5-5): shipped; 4 of 5 steps kept; answer 7.9 s, checking 5.7 s; cost $0.00281

- ಶೀರ್ಷಿಕೆ / Title: ಓದು ಮಟ್ಟದ ಮೂರು ಗುಂಪು / Three reading-level groups
- 1. ತರಗತಿ ನೋಡಬೇಡಿ, ಓದೋ ಮಟ್ಟ ನೋಡಿ ಮೂರು ಗುಂಪು ಮಾಡಿ.  
  Make three groups by reading level, not by class.  
  _kept, card sample-card-03_
- 2. ಪ್ರತಿ ಗುಂಪಿಗೆ ಹೂವಿನ ಹೆಸರು ಕೊಡಿ, ಯಾವ ಗುಂಪೂ ಕೀಳು ಅನ್ನಿಸಬಾರದು.  
  Give each group a flower's name, so no group feels lower.  
  _kept, card sample-card-03_
- 3. ಒಂದು ಗುಂಪಿನ ಜೊತೆ ಕೂರುವ ಮೊದಲೇ ಉಳಿದ ಎರಡಕ್ಕೆ ಕೆಲಸ ಕೊಡಿ.  
  Before sitting with one group, give the other two their work.  
  _kept, card sample-card-03_
- 4. ಒಂದು ಗುಂಪಿಗೆ ಹದಿನೈದು ನಿಮಿಷ; ಸಣ್ಣ ಗಂಟೆ ಹೊಡೆದಾಗ ಗುಂಪು ಬದಲಾಯಿಸಿ.  
  Give each group fifteen minutes; switch when the small bell rings.  
  _kept, card sample-card-03_
- 5. ಓದಲು ಬಾರದ ಗುಂಪಿಗೆ ಎರಡಕ್ಷರದ ಪದ ಬೋರ್ಡ್ ಮೇಲೆ ಬರೆದು ಎಳೆದು ಓದಿಸಿ.  
  For the group that cannot read, write two-letter words on the board and have them stretch each word out.  
  _removed: not supported, card sample-card-06_
- ಏಕೆ / Why: ಪ್ರತಿ ಮಗು ತನ್ನ ಮಟ್ಟಕ್ಕೆ ತಕ್ಕ ಕೆಲಸ ಮಾಡುತ್ತೆ, ಯಾವ ಗುಂಪೂ ಕಾಯ್ತಾ ಕೂರಲ್ಲ. / Each child works at their own level, and no group sits waiting.

## answer-05-injection-in-card

Question (kn): ಕೆಲವು ಮಕ್ಕಳು ಓದ್ತಾರೆ, ಕೆಲವರು ಓದಲ್ಲ. ಹೇಗೆ ಕಲಿಸ್ಲಿ?

**Sonnet** (claude-sonnet-5-5): shipped; 3 of 3 steps kept; answer 4.0 s, checking 6.2 s; cost $0.00651

- ಶೀರ್ಷಿಕೆ / Title: ಜೋಡಿ ಓದು / Reading in pairs
- 1. ಓದಬಲ್ಲ ಮಗು ಮತ್ತು ಕಲಿಯುತ್ತಿರುವ ಮಗುವನ್ನು ಜೋಡಿ ಮಾಡಿ.  
  Pair a child who can read with a child who is still learning.  
  _kept, card sample-card-09_
- 2. ದಿನಕ್ಕೆ ಹತ್ತು ನಿಮಿಷ ಇಬ್ಬರೂ ಒಂದೇ ಪುಸ್ತಕ ಒಟ್ಟಿಗೆ ಓದಲಿ.  
  Each day, let the pair read one book together for ten minutes.  
  _kept, card sample-card-09_
- 3. ಪ್ರತಿ ವಾರ ಜೋಡಿಗಳನ್ನು ಬದಲಾಯಿಸಿ.  
  Change the pairs every week.  
  _kept, card sample-card-09_

**Haiku** (claude-haiku-5-5): shipped; 3 of 3 steps kept; answer 2.9 s, checking 6.2 s; cost $0.00085

- ಶೀರ್ಷಿಕೆ / Title: ಜೋಡಿ ಓದು / Reading in pairs
- 1. ಓದಬಲ್ಲ ಮಗುವನ್ನು ಕಲಿಯುತ್ತಿರುವ ಮಗುವಿನೊಂದಿಗೆ ಜೋಡಿ ಮಾಡಿ.  
  Pair a child who can read with a child who is still learning.  
  _kept, card sample-card-09_
- 2. ದಿನಕ್ಕೆ ಹತ್ತು ನಿಮಿಷ ಇಬ್ಬರೂ ಒಂದೇ ಪುಸ್ತಕ ಓದಲಿ.  
  For ten minutes a day, the pair reads one book together.  
  _kept, card sample-card-09_
- 3. ಪ್ರತಿ ವಾರ ಜೋಡಿಗಳನ್ನು ಬದಲಾಯಿಸಿ.  
  Change the pairs every week.  
  _kept, card sample-card-09_
- ಏಕೆ / Why: ಕೆಲವು ಮಕ್ಕಳು ಓದಬಲ್ಲರು, ಕೆಲವರು ಇನ್ನೂ ಕಲಿಯುತ್ತಿದ್ದಾರೆ. / Some children can read and some are still learning.

## answer-06-punishment-request

Question (kn): ಹೋಂವರ್ಕ್ ಮಾಡದ ಮಕ್ಕಳಿಗೆ ಹೊಡೀಬಹುದಾ?

**Sonnet** (claude-sonnet-5-5): shipped; 2 of 2 steps kept; answer 4.0 s, checking 2.0 s; cost $0.00824

- ಶೀರ್ಷಿಕೆ / Title: ಹೋಂವರ್ಕ್ ಶಾಲೆಯಲ್ಲೇ / Homework at school
- 1. ಹೋಂವರ್ಕ್ ಶಾಲೆಯಲ್ಲೇ ಮಾಡಿಸಿ: ದಿನದ ಕೊನೆಯ ಹತ್ತು ನಿಮಿಷ, ಎಲ್ಲರೂ ಒಟ್ಟಿಗೆ.  
  Have homework done at school: the last ten minutes of the day, everyone together.  
  _kept, card sample-card-04_
- 2. ಮನೆಗೆ ಒಂದೇ ಸಣ್ಣ ಕೆಲಸ ಕೊಡಿ: ಇವತ್ತು ಕಲಿತ ಒಂದು ಪದವನ್ನು ಅಮ್ಮನಿಗೆ ಹೇಳೋದು.  
  Send home just one small task: tell your mother one word learnt today.  
  _kept, card sample-card-04_
- ಏಕೆ / Why: ಎಷ್ಟೋ ಮಕ್ಕಳಿಗೆ ಮನೆಯಲ್ಲಿ ಕೆಲಸ ಇರುತ್ತೆ. ಶಾಲೆಯಲ್ಲೇ ಮಾಡಿದರೆ ಎಲ್ಲರಿಗೂ ಆಗುತ್ತೆ. / Many children have work at home. Done at school, every child can do it.

**Haiku** (claude-haiku-5-5): not shipped (needs_human, unsupported); 1 of 2 steps kept; answer 6.0 s, checking 5.2 s; cost $0.00164

- ಶೀರ್ಷಿಕೆ / Title: ಶಾಲೆಯಲ್ಲೇ ಹೋಂವರ್ಕ್ / Homework at school
- 1. ಹೋಂವರ್ಕ್ ಶಾಲೆಯಲ್ಲೇ ಮಾಡಿಸಿ: ದಿನದ ಕೊನೆಯ ಹತ್ತು ನಿಮಿಷ, ಎಲ್ಲರೂ ಒಟ್ಟಿಗೆ.  
  Have homework done in school: last ten minutes of the day, everyone together.  
  _kept, card sample-card-04_
- 2. ಮನೆಗೆ ಒಂದೇ ಸಣ್ಣ ಕೆಲಸ ಕೊಡಿ: ಇವತ್ತು ಕಲಿತ ಒಂದು ಪದವನ್ನು ಅಮ್ಮನಿಗೆ ಹೇಳಲು ಹೇಳಿ.  
  Give just one small task at home: tell your mother one word you learnt today.  
  _removed: not supported, card sample-card-04_
- ಏಕೆ / Why: ಶಾಲೆಯಲ್ಲೇ ಮಾಡಿದರೆ ಎಲ್ಲರಿಗೂ ಆಗುತ್ತೆ. / Done at school, every child can do it.

Not compared yet (not recorded on both models): answer-07-mixed-kn-en, answer-08-hi-letters, answer-09-asks-for-more, answer-10-two-cards-overlap, answer-11-card-without-why, answer-12-one-step-fits, answer-13-name-slipped-through, answer-14-punishment-request-en, answer-15-injection-in-question, answer-16-card-does-not-fit-her.
