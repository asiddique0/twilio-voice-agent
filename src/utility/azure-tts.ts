import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { errorMetadata, noticeMetadata, writeLog } from "./logger";
import { AzureTTSConfig } from "../common/types";
require("dotenv").config();

function getSsml(sentence: string, voiceName: string) {
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
        <voice name="${voiceName}">
            <mstts:express-as style="customerservice" styledegree="2">
                <prosody rate="default" volume="default" pitch="+5.00%">
                  ${sentence}
                </prosody>
            </mstts:express-as>
            <prosody rate="+10.00%" volume="+30.00%" pitch="+10.00%"></prosody>
        </voice>
    </speak>
  `;
}

export async function getAudioResponseStream(
  sentence: string,
  streamSid: string,
  azureSttConfig: AzureTTSConfig
): Promise<Buffer> {
  return new Promise((resolve) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.SPEECH_KEY,
      process.env.SPEECH_REGION
    );
    speechConfig.speechSynthesisVoiceName =
      azureSttConfig?.voice || "en-US-JennyNeural";
    // set the ssml voice

    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoMULaw;
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    synthesizer.speakSsmlAsync(
      getSsml(sentence, speechConfig.speechSynthesisVoiceName),
      (result) => {
        writeLog(noticeMetadata, {
          message: `Azure TTS Done`,
          streamSid: streamSid,
        });
        resolve(Buffer.from(result.audioData));
      },
      (error) => {
        writeLog(errorMetadata, {
          message: `Error in Azure TTS: ${error}`,
          streamSid: streamSid,
        });
      }
    );
  });
}
