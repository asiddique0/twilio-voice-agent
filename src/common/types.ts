import OpenAI from "openai";
import { CallListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/call";

export interface TwilioMessage {
  event: "connected" | "start" | "media" | "stop" | "mark" | "clear";
  protocol?: string;
  version?: string;
  sequenceNumber?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters?: {
      id?: string;
    };
  };
  mediaFormat?: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
  streamSid?: string;
  media?: {
    track?: string;
    chunk?: string;
    timestamp?: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

export interface LogStructure {
  message: string;
  streamSid?: string;
}

export interface AzureTTSConfig {
  voice: string;
  speechRate?: number;
}

export interface PlayHTConfig {
  voice: string;
}

export interface OpenAIAssistantConfig {
  id: string;
  value?: OpenAI.Beta.Assistants.AssistantCreateParams;
}

export interface AssistantConfig {
  opener: string;
  config: OpenAIAssistantConfig;
  textToSpeechConfig: {
    service: "play.ht" | "azure";
    azureTTSConfig?: AzureTTSConfig;
    playHTConfig?: PlayHTConfig;
  };
}

export interface AssistantConfigRequest {
  id: string;
  value: AssistantConfig;
}

export interface OutboundCallOptions extends CallListInstanceCreateOptions {
  id: string;
}

export interface AvailablePhoneNumbersRequest {
  countryCode: string;
  areaCode: number;
  limit: number;
}

export interface UpdatePhoneNumberRequest {
  sid: string;
  voiceUrl: string;
}
