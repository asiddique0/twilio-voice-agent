/* eslint-disable indent */
import "express-async-errors";
import WebSocket from "ws";
import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import twilio from "twilio";
import {
  debugMetadata,
  infoMetadata,
  noticeMetadata,
  errorMetadata,
  writeLog,
} from "./utility/logger";
import { CallState } from "./common/CallState";
import {
  TwilioMessage,
  AssistantConfigRequest,
  OutboundCallOptions,
  AvailablePhoneNumbersRequest,
  UpdatePhoneNumberRequest,
} from "./common/types";
import {
  createClearMessage,
  createInitialMessage,
  getTwilioConnectXML,
} from "./utility/twilio";
import {
  createAssistantConfig,
  getAllAssistantConfigs,
  getAssistantConfig,
} from "./firestore/queries";
import { isNil } from "lodash";
import { getAudioResponseStream } from "./utility/azure-tts";
import { streamAudioResponse } from "./utility/playht-tts";
require("dotenv").config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT: number = Number(process.env.PORT) || 8083;

app.use(cors());
app.use(morgan("common"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Handle Web Socket Connection
wss.on("connection", async (ws: WebSocket) => {
  let callState: CallState = null;
  let timeoutId: NodeJS.Timeout = null;

  const startTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      ws.terminate();
    }, 60000); // 60 seconds timeout
  };

  ws.on("message", async (message: string) => {
    startTimeout(); // Reset the timeout whenever a message is received

    const msg: TwilioMessage = JSON.parse(message);

    switch (msg.event) {
      case "connected": {
        // Initialize Call State
        callState = new CallState(ws);
        break;
      }
      case "start": {
        // Initialize the streamSid
        callState.streamSid = msg.streamSid;

        // Initialize the callSid
        writeLog(debugMetadata, {
          message: "Starting media stream",
          streamSid: callState.streamSid,
        });

        const assistantConfigId = msg.start.customParameters.id;
        writeLog(noticeMetadata, {
          message: `Websocket start event. AssistantConfigID: ${assistantConfigId}`,
        });

        // Initialize the session config
        callState.assistantConfigRequest = await getAssistantConfig(
          assistantConfigId
        );

        // Initialize the assistant
        await callState.initializeAssistant();

        // Send initial media message
        if (
          callState.assistantConfigRequest.value.textToSpeechConfig.service ===
          "play.ht"
        ) {
          const audio = await streamAudioResponse(
            callState.assistantConfigRequest.value.opener,
            callState.assistantConfigRequest.value.textToSpeechConfig
              .playHTConfig
          );
          audio.on("data", (chunk: Buffer) => {
            callState?.sendAudioToTwilio(chunk);
          });
        } else {
          const audioBuffer = await getAudioResponseStream(
            callState.assistantConfigRequest.value.opener,
            callState.streamSid,
            callState.assistantConfigRequest.value.textToSpeechConfig
              .azureTTSConfig
          );
          const mediaMessage = createInitialMessage(
            msg.streamSid,
            audioBuffer.toString("base64")
          );
          ws.send(JSON.stringify(mediaMessage));
        }

        break;
      }
      case "media": {
        // Write Media Packets to the recognize stream
        if (!isNil(callState)) {
          if (
            !isNil(callState?.recognizeStream) &&
            !callState.recognizeStream.destroyed
          ) {
            callState.recognizeStream.write(msg.media.payload);
          } else if (
            isNil(callState?.recognizeStream) ||
            callState.recognizeStream.destroyed
          ) {
            callState.restartStream();
            callState.recognizeStream.write(msg.media.payload);
          }
          if (callState.speakingTracker.assistantSpeaking) {
            ws.send(JSON.stringify(createClearMessage(msg.streamSid)));
          }
        }
        break;
      }
      case "mark": {
        if (msg.mark.name === "<END_OF_CALL>") {
          writeLog(debugMetadata, {
            message: "Call was ended by assistant",
            streamSid: msg?.streamSid,
          });
          callState.destroyStream();
          callState = null;
          ws.close();
        }
        break;
      }
      case "stop": {
        writeLog(debugMetadata, {
          message: "Call has ended",
          streamSid: callState.streamSid,
        });
        callState.destroyStream();
        callState = null;
        break;
      }
    }
  });

  ws.on("ping", startTimeout); // Reset the timeout whenever a ping is received
  ws.on("pong", startTimeout); // Reset the timeout whenever a pong is received

  startTimeout(); // Start the timeout when the connection is established
});

wss.on("error", (err) => {
  writeLog(errorMetadata, { message: `Web Socket Server Error: ${err}` });
});

app.post("/", async (req, res) => {
  writeLog(
    noticeMetadata,
    { message: `Received Twilio Request. AssistantConfigID: ${req.query.id}` },
    true
  );

  res.set("Content-Type", "text/xml");

  res.send(getTwilioConnectXML(req.query.id as string, req.headers.host));
});

app.get("/health", async (req, res) => {
  writeLog(infoMetadata, { message: "Health Check" });
  res.send("OK");
});

//#region twilio

app.post("/initiateOutboundCall", async (req, res) => {
  const body = req.body as OutboundCallOptions;

  const connectXml = getTwilioConnectXML(body.id, process.env.PUBLIC_HOSTNAME);

  const call = await client.calls.create({
    twiml: connectXml,
    to: body.to,
    from: body.from,
    record: body.record || false,
  });
  res.json(call.toJSON());
});

app.post("/getAvailableNumbers", async (req, res) => {
  const body = req.body as AvailablePhoneNumbersRequest;
  const numbers = await client
    .availablePhoneNumbers(body.countryCode)
    .local.list({
      limit: body?.limit || 20,
      areaCode: body?.areaCode,
    });
  res.json(numbers);
});

app.post("/getIncludedNumbers", async (req, res) => {
  const numbers = await client.incomingPhoneNumbers.list();
  res.json(numbers);
});

app.post("/updateNumber", async (req, res) => {
  const body = req.body as UpdatePhoneNumberRequest;
  const number = await client.incomingPhoneNumbers(body.sid).update({
    voiceUrl: body.voiceUrl,
  });
  res.json(number);
});

//#endregion twilio

//#region assistantConfig

app.post("/createAssistantConfig", async (req, res) => {
  const body = req.body as AssistantConfigRequest;
  await createAssistantConfig(body);
  res.send("OK");
});

app.post("/getAssistantConfig", async (req, res) => {
  const config = await getAssistantConfig(req.body.assistantConfigId);
  res.send(config);
});

app.get("/getAllAssistantConfigs", async (req, res) => {
  const configs = await getAllAssistantConfigs();
  res.send(configs);
});

//#endregion AssistantConfig

writeLog(noticeMetadata, { message: `Starting server on port ${PORT}...` });
server.listen(PORT);
