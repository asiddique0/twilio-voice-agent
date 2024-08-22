import WebSocket from "ws";
import { OutboundCallOptions, TwilioMessage } from "../common/types";

export function convertToTwilioMessage(
  message: WebSocket.RawData
): TwilioMessage {
  return JSON.parse(message.toString("utf8"));
}

export function createInitialMessage(
  streamSid: string,
  payload: string
): TwilioMessage {
  return {
    event: "media",
    streamSid: streamSid,
    media: {
      payload: payload ? payload : "",
    },
  };
}

export function createMarkMessage(
  streamSid: string,
  markName: string
): TwilioMessage {
  return {
    event: "mark",
    streamSid: streamSid,
    mark: {
      name: markName,
    },
  };
}

export function createMediaMessage(
  streamSid: string,
  payload: string
): TwilioMessage {
  return {
    event: "media",
    streamSid: streamSid,
    media: {
      payload: payload,
    },
  };
}

export function createClearMessage(streamSid: string): TwilioMessage {
  return {
    event: "clear",
    streamSid: streamSid,
  };
}

export function getTwilioConnectXML(assistantConfigId: string, host: string) {
  return `
  <Response>
    <Connect>
      <Stream url="wss://${host}/" >
        <Parameter name="id" value="${assistantConfigId}" />
      </Stream>
    </Connect>
  </Response>
 `;
}
