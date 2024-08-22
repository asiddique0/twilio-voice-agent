import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import { errorMetadata, writeLog } from "./logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function convertToMulaw(stream: Readable) {
  return new Promise<Buffer>((resolve, reject) => {
    const ffstream = ffmpeg()
      .input(stream)
      .inputFormat("mp3")
      .audioCodec("pcm_mulaw")
      .audioChannels(1)
      .audioFrequency(8000)
      .outputFormat("mulaw")
      .on("error", (err) => {
        writeLog(errorMetadata, {
          message: `Error converting to mulaw: ${err}`,
        });
        reject();
      })
      .pipe();
    const outputArr: Buffer[] = [];
    ffstream
      .on("data", (data: Buffer) => {
        outputArr.push(data);
      })
      .on("end", () => {
        resolve(Buffer.concat(outputArr));
      });
  });
}
