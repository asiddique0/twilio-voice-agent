/* eslint-disable indent */
import { Logging } from "@google-cloud/logging";
import { LogEntry } from "@google-cloud/logging/build/src/entry";
import { LogStructure } from "../common/types";
require("dotenv").config();

const enableDebugStdout = Boolean(process.env.ENABLE_DEBUG_STDOUT);
const enableCriticalLoggingOnly = Boolean(process.env.ENABLE_CRIT_ONLY);

const logging = new Logging({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const logger = logging.log("juiz-express", {
  removeCircular: true,
});

const debugMetadata: LogEntry = {
  resource: { type: "global" },
  severity: "DEBUG",
};

const infoMetadata: LogEntry = {
  resource: { type: "global" },
  severity: "INFO",
};

const noticeMetadata: LogEntry = {
  resource: { type: "global" },
  severity: "NOTICE",
};

const errorMetadata: LogEntry = {
  resource: { type: "global" },
  severity: "ERROR",
};

const consoleLog = (metadata: LogEntry, message: LogStructure) => {
  switch (metadata.severity) {
    case "DEBUG": {
      console.debug(message);
      break;
    }
    case "INFO": {
      console.info(message);
      break;
    }
    case "NOTICE": {
      console.log(message);
      break;
    }
    case "ERROR": {
      console.error(message);
      break;
    }
  }
};

const writeLog = (metadata: LogEntry, data: LogStructure, localOnly = true) => {
  if (enableDebugStdout) {
    consoleLog(metadata, data);
    if (localOnly) {
      return;
    }
  }

  if (enableCriticalLoggingOnly) {
    if (metadata.severity === "ERROR") {
      const entry = logger.entry(metadata, data);
      logger.write(entry);
    }
  } else {
    const entry = logger.entry(metadata, data);
    logger.write(entry);
  }
};

export {
  logger,
  debugMetadata,
  infoMetadata,
  noticeMetadata,
  errorMetadata,
  writeLog,
};
