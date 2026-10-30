import { Composition, Still } from "remotion";
import numbersJson from "../numbers.json";
import scriptJson from "../script.json";
import { FontCheck } from "./FontCheck";
import { loadFonts } from "./fonts";
import { FPS, HEIGHT, WIDTH, numbersSchema, scriptSchema, totalSeconds } from "./schema";
import { Story, type StoryProps } from "./Story";
import { Thumbnail } from "./Thumbnail";

loadFonts();

// script.json and numbers.json are checked here too, so a bad edit fails the Studio and every
// render with the schema's own message (scripts/check.ts says the same before anything starts).
const script = scriptSchema.parse(scriptJson);
const numbers = numbersSchema.parse(numbersJson);

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Story"
        component={Story}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={Math.round(totalSeconds(script) * FPS)}
        defaultProps={{ mode: "draft", script, numbers } satisfies StoryProps}
      />
      <Still id="FontCheck" component={FontCheck} width={WIDTH} height={HEIGHT} />
      <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
    </>
  );
}
