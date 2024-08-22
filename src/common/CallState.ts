import { SpeechClient } from "@google-cloud/speech";
import Pumpify from "pumpify";
import { isNil } from "lodash";
import sttProtosTypes from "@google-cloud/speech/build/protos/protos";
import WebSocket from "ws";
import intermediateResponses from "../static/intermediateResponses.json";
import { createMarkMessage, createMediaMessage } from "../utility/twilio";
import { writeLog, errorMetadata, debugMetadata } from "../utility/logger";
import { AssistantConfigRequest } from "../common/types";
import { getAudioResponseStream } from "../utility/azure-tts";
import { Assistant } from "../assistant/assistant";
import { streamAudioResponse } from "../utility/playht-tts";
require("dotenv").config();

export class CallState {
  ws: WebSocket;
  streamSid: string;
  sttClient: SpeechClient;
  recognizeStream: Pumpify;
  speakingTracker: {
    assistantSpeaking: boolean;
  };
  assistantConfigRequest: AssistantConfigRequest;
  delimiter: Set<string>;
  messageQueue: string[];
  intermediateResponses: string[];
  assistant: Assistant;

  sttSpeechConfig: sttProtosTypes.google.cloud.speech.v1.IStreamingRecognitionConfig =
    {
      config: {
        encoding: "MULAW",
        sampleRateHertz: 8000,
        languageCode: "en-US",
        model: "telephony",
        useEnhanced: true,
      },
      interimResults: false,
    };

  constructor(ws: WebSocket) {
    this.initializeCallState(ws);
  }

  initializeCallState(ws: WebSocket): void {
    this.ws = ws;
    this.sttClient = new SpeechClient({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.createStream();
    this.delimiter = new Set<string>([".", "?", ";", "!"]);
    this.messageQueue = [];
    this.intermediateResponses = [];
    this.speakingTracker = {
      assistantSpeaking: false,
    };
    setInterval(
      function () {
        this.processQueue();
      }.bind(this),
      500
    );
  }

  initializeAssistant = async () => {
    this.assistant = new Assistant(this.assistantConfigRequest.value.config.id);
  };

  createStream(): void {
    this.recognizeStream = this.sttClient
      .streamingRecognize(this.sttSpeechConfig)
      .on("error", (err) =>
        writeLog(errorMetadata, {
          message: `Google STT error: ${err}`,
          streamSid: this.streamSid,
        })
      )
      .on(
        "data",
        (
          data: sttProtosTypes.google.cloud.speech.v1.StreamingRecognizeResponse
        ) => {
          const transcript = data.results.at(0).alternatives.at(0).transcript;
          if (data.results.at(0).isFinal && transcript.trim().length > 0) {
            this.messageQueue.push(transcript);
          }
          writeLog(
            debugMetadata,
            {
              message: `isFinal: ${data.results.at(0).isFinal}; Transcript: ${
                data.results.at(0).alternatives.at(0).transcript
              }`,
            },
            true
          );
        }
      );
  }

  isStreamOperational(): boolean {
    return (
      !isNil(this.recognizeStream) &&
      !this.recognizeStream.destroyed &&
      !this.recognizeStream.writableEnded
    );
  }

  restartStream(): void {
    if (this.isStreamOperational()) {
      this.recognizeStream.end();
      this.recognizeStream.destroy();
      this.recognizeStream = null;
    }
    this.createStream();
  }

  destroyStream(): void {
    if (this.isStreamOperational()) {
      this.recognizeStream.end();
      this.recognizeStream.destroy();
      this.recognizeStream = null;
    }
  }

  sendAudioToTwilio(buffer: Buffer): void {
    const audioBase64 = buffer.toString("base64");
    const message = JSON.stringify(
      createMediaMessage(this.streamSid, audioBase64)
    );
    this.ws.send(message);
  }

  sendAzureTTSResponseToTwilio = async (message: string) => {
    const audio = await getAudioResponseStream(
      message,
      this.streamSid,
      this.assistantConfigRequest.value.textToSpeechConfig.azureTTSConfig
    );
    this.sendAudioToTwilio(audio);
  };

  sendPlayHTResponseToTwilio = async (message: string) => {
    const audio = await streamAudioResponse(
      message,
      this.assistantConfigRequest.value.textToSpeechConfig.playHTConfig
    );
    audio.on("data", (chunk: Buffer) => {
      writeLog(debugMetadata, {
        message: `(DEBUG) Sending play.ht audio to Twilio 2 with message: ${message}`,
        streamSid: this.streamSid,
      });
      this.sendAudioToTwilio(chunk);
    });
  };

  processQueue = async () => {
    if (this.intermediateResponses.length > 0) {
      this.speakingTracker.assistantSpeaking = true;
      // pop out all intermediate responses and send them to Twilio
      for (let i = 0; i < this.intermediateResponses.length; i++) {
        const message = this.intermediateResponses.shift();
        writeLog(debugMetadata, {
          message: `(DEBUG) Sending intermediate response to Twilio with message: ${message}`,
          streamSid: this.streamSid,
        });
        await this.sendAzureTTSResponseToTwilio(message);
      }
      this.speakingTracker.assistantSpeaking = false;
    }

    if (
      this.messageQueue.length === 0 ||
      this.speakingTracker.assistantSpeaking
    ) {
      return;
    }

    writeLog(debugMetadata, {
      message: `(DEBUG) Sending message to assistant`,
      streamSid: this.streamSid,
    });

    this.speakingTracker.assistantSpeaking = true;

    const message = this.messageQueue.shift();
    await this.assistant.addMessage(message);

    const intermediateResponseCallback = () => {
      const message =
        intermediateResponses[
          Math.floor(Math.random() * intermediateResponses.length)
        ].text;

      this.intermediateResponses.push(message);
    };

    const response = await this.assistant.runAssistant(
      intermediateResponseCallback
    );

    const cleanedResponse = response
      .replace(/【.*?】/g, "")
      .replace(/<.*?>/g, "")
      .replace("END_OF_CALL", "");

    if (
      this.assistantConfigRequest.value.textToSpeechConfig.service === "play.ht"
    ) {
      await this.sendPlayHTResponseToTwilio(cleanedResponse);
    } else {
      await this.sendAzureTTSResponseToTwilio(cleanedResponse);
    }

    this.speakingTracker.assistantSpeaking = false;

    if (response.includes("END_OF_CALL")) {
      const callEndMessage = createMarkMessage(this.streamSid, "<END_OF_CALL>");
      setTimeout(() => {
        this.ws.send(JSON.stringify(callEndMessage));
      }, 5000);
    }
  };
}
