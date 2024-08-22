import OpenAI from "openai";
import { debugMetadata, writeLog } from "../utility/logger";
export const openai = new OpenAI();

export class Assistant {
  assistantId: string;
  assistant: OpenAI.Beta.Assistant;
  thread: OpenAI.Beta.Thread;

  constructor(assistantId: string) {
    this.assistantId = assistantId;
    this.initializeAssistant();
  }

  initializeAssistant = async () => {
    this.assistant = await openai.beta.assistants.retrieve(this.assistantId);
    this.thread = await openai.beta.threads.create();
  };

  addMessage = async (message: string) => {
    await openai.beta.threads.messages.create(this.thread.id, {
      role: "user",
      content: message,
    });
  };

  runAssistant = async (intermediateResponseCallback: () => void) => {
    const initiateRun = await openai.beta.threads.runs.create(this.thread.id, {
      assistant_id: this.assistant.id,
    });

    let intermediateResponseGiven = false;

    const completedRun: OpenAI.Beta.Threads.Runs.Run = await new Promise(
      (resolve, reject) => {
        let intervalSum = 0;
        const interval = setInterval(async () => {
          const run = await openai.beta.threads.runs.retrieve(
            this.thread.id,
            initiateRun.id
          );
          if (run.status === "completed") {
            clearInterval(interval);
            resolve(run);
          }
          if (intervalSum >= 20000) {
            writeLog(debugMetadata, {
              message: `Assistant run timed out`,
            });
            clearInterval(interval);
            reject(run);
          } else if (intervalSum >= 5000 && !intermediateResponseGiven) {
            intermediateResponseCallback();
            intermediateResponseGiven = true;
          }
          intervalSum += 1000;
        }, 1000);
      }
    );

    const messages = await openai.beta.threads.messages.list(this.thread.id);

    const logMessages = messages.data.map((message) => {
      return {
        role: message.role,
        text: (
          message.content.at(
            0
          ) as OpenAI.Beta.Threads.Messages.MessageContentText
        ).text.value,
      };
    });
    console.info("---- START CONVERSATION HISTORY ----");
    console.info(JSON.stringify(logMessages, null, 2));
    console.info("---- END CONVERSATION HISTORY ----");
    return (
      messages.data
        .filter((message) => message.role === "assistant")
        .at(0)
        .content.at(0) as OpenAI.Beta.Threads.Messages.MessageContentText
    ).text.value;
  };
}
