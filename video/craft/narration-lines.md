# Narration lines · Parampara film (2:58)

Every narrated line in the film, in order, generated from `video/script.json` on 29 Oct. If a line here and `script.json` ever differ, `script.json` wins: copy it back here.

## How to make them by hand on elevenlabs.io
1. Text to Speech. Use **George** (the founder's pick, 30 Oct; `pnpm --dir video narrate` renders these through the API) and the best model on offer (Eleven v4). Settings: **stability 0.5, similarity 0.8, style 0 to 0.1, speed 0.9**, speaker boost on.
2. Paste **one line at a time**, exactly as written below (punctuation included: the commas are the pauses). Generate, listen, regenerate if a name sounds wrong.
3. Download as MP3 and save it with the **exact file name** in the table, into **`video/public/audio/`** (next to `mahesh-open.mp3`). Example: `video/public/audio/vo-open-name.mp3`.
4. Run `pnpm --dir video check`. It lists any file still missing. Loudness is evened out to −16 LUFS by the render step, so no need to adjust volume.

**Must stay under the max length**: a take longer than its scene is cut at the scene's end. The natural length assumes about 2.65 words a second (the pace of the auditions); if a take runs long, regenerate at speed 1.0, or tell Claude and the scene times move.

Pronunciation: Mahesh Bedavatti (*MAH-hesh beh-dah-VUT-tee*) · Kannada (*KUN-nuh-duh*, never "Canada") · Talakal (*TUH-luh-kul*) · Koppal (*KOP-pul*) · Ambedkar (*um-BAYD-kur*) · Parampara (*puh-RUM-puh-ruh*) · Kannadi (*KUN-nuh-dee*). If one is said wrong, spell it that way in the box (the file name stays the same).

| # | File | Exact words | Starts at | Take (s) | Max length (s) |
|---|---|---|---|---|---|
| 1 | `vo-open-name.mp3` | Mahesh Bedavatti has taught in government schools for thirty two years. One day, like every teacher, he will retire. And everything he knows will leave the classroom with him. | 0:09.4 | 11.4 | 11.6 |
| 2 | `vo-problem-board.mp3` | In Karnataka, eight thousand schools have just one teacher. No colleague to ask. | 0:21.3 | 6.0 | 6.2 |
| 3 | `vo-problem-numbers.mp3` | Only fifteen in a hundred children in Class 3 can read a Class 2 text. The help a young teacher needs already exists. It lives in teachers like him. | 0:27.9 | 11.1 | 11.4 |
| 4 | `vo-promise-lamp.mp3` | Parampara means passing it on. One lamp lights another, and loses nothing. | 0:39.5 | 5.8 | 6.1 |
| 5 | `vo-capture-notes.mp3` | He didn't install anything. | 0:49.9 | 1.9 | 4.2 |
| 6 | `vo-capture-import.mp3` | He sent seven WhatsApp voice notes, under six minutes of his voice, and they became six practice cards. Every step is tied to the second he said it. | 0:54.5 | 9.7 | 9.9 |
| 7 | `vo-check.mp3` | A headmaster checks every card. Nothing reaches a teacher unchecked. | 1:04.7 | 5.2 | 5.4 |
| 8 | `vo-deliver-window.mp3` | Nine at night. | 1:10.4 | 1.4 | 1.9 |
| 9 | `vo-deliver-phone.mp3` | A young teacher, alone, worried about a child who still cannot write letters. | 1:12.7 | 5.4 | 5.7 |
| 10 | `vo-deliver-ask.mp3` | She asks, in Kannada. In seconds, she hears what to try tomorrow morning, from a real master, by name. | 1:18.6 | 7.8 | 8.2 |
| 11 | `vo-hear-master.mp3` | And she can hear him say it himself. | 1:29.2 | 2.4 | 3.6 |
| 12 | `vo-learn-worked.mp3` | When it works, she says so. | 1:42.1 | 2.0 | 2.3 |
| 13 | `vo-learn-master.mp3` | And she can send thirty two years of experience a thank you. | 1:44.7 | 3.8 | 4.1 |
| 14 | `vo-spread-hindi.mp3` | Wisdom no longer stays inside one language. A method from Koppal can help a teacher in Uttar Pradesh, in Hindi, still in his name. | 1:49.1 | 9.2 | 9.4 |
| 15 | `vo-spread-pulse.mp3` | District officers see what teachers struggle with this week, without ever watching a teacher. | 1:58.8 | 5.2 | 6.2 |
| 16 | `vo-trust-trace.mp3` | A second Claude model checks every step against the cards. If it is not grounded, it stays silent. | 2:05.3 | 6.6 | 6.8 |
| 17 | `vo-trust-safety.mp3` | Children's names are removed before anything is stored. | 2:12.4 | 3.4 | 4.7 |
| 18 | `vo-trust-offline.mp3` | It works on slow networks and offline, | 2:17.5 | 3.0 | 3.2 |
| 19 | `vo-trust-cost.mp3` | for about thirty three rupees a teacher a month. And it is open source. | 2:21.0 | 5.2 | 5.4 |
| 20 | `vo-proof.mp3` | This week, at Government Higher Primary School, Ambedkar Nagar, Talakal, his colleagues opened Parampara for the first time. | 2:26.7 | 7.8 | 8.0 |
| 21 | `vo-vision-lamps.mp3` | Parampara is our first lamp. Next, Kannadi helps a teacher see every child's learning from a notebook photo. | 2:35.0 | 7.7 | 7.9 |
| 22 | `vo-vision-map.mp3` | One foundation, for every classroom in India, starting from Karnataka. | 2:43.2 | 5.1 | 5.4 |

22 lines, 317 words. His own voice (`mahesh-open`, `mahesh-hear`, `mahesh-close`) is cut from his notes; never generate it.

Respelled for the voice only (`scripts/narrate.ts`, `SAY`): Bedavatti as "Bedavutti", Kannada as "Kunnada". Every take was transcribed back (Saaras v4, en-IN) on 30 Oct; the log is in `craft/ASSETS.md`.

End credit (on screen): *Narration voice: AI (ElevenLabs)*, and a chip on the first narrated scene.
