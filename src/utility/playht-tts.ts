import * as PlayHT from "playht";
import { PlayHTConfig } from "../common/types";
require("dotenv").config();

PlayHT.init({
  apiKey: process.env.PLAYHT_API_KEY,
  userId: process.env.PLAYHT_USER_ID,
  defaultVoiceId: "s3://peregrine-voices/evelyn 2 saad parrot/manifest.json",
  defaultVoiceEngine: "PlayHT2.0",
});

export async function streamAudioResponse(
  sentence: string,
  config: PlayHTConfig
) {
  return await PlayHT.stream(sentence, {
    voiceEngine: "PlayHT2.0-turbo",
    sampleRate: 8000,
    outputFormat: "mulaw",
    voiceId:
      config?.voice ||
      "s3://peregrine-voices/evelyn 2 saad parrot/manifest.json",
  });
}

export async function getAudioResponse(sentence: string, config: PlayHTConfig) {
  return await PlayHT.generate(sentence, {
    voiceEngine: "PlayHT2.0",
    sampleRate: 8000,
    outputFormat: "mulaw",
    voiceId:
      config?.voice ||
      "s3://peregrine-voices/evelyn 2 saad parrot/manifest.json",
  });
}
