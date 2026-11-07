import { spawn } from "node:child_process";

const maximumExtractedCharacters = 120000;

export function extractReportText(
  file: Buffer,
  mediaType: string,
): Promise<string> {
  const command = mediaType === "application/pdf" ? "pdftotext" : "tesseract";
  const args =
    mediaType === "application/pdf"
      ? ["-layout", "-", "-"]
      : ["stdin", "stdout", "-l", "eng"];

  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const output: Buffer[] = [];
    let outputBytes = 0;
    let errorOutput = "";
    let settled = false;
    const timeout = setTimeout(() => {
      process.kill();
      finish(new Error("Report text extraction timed out"));
    }, 30000);

    const finish = (error?: Error, text?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(text ?? "");
    };

    process.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maximumExtractedCharacters * 4) {
        process.kill();
        finish(new Error("Extracted report exceeds the text limit"));
        return;
      }
      output.push(chunk);
    });
    process.stderr.on("data", (chunk: Buffer) => {
      if (errorOutput.length < 4000) {
        errorOutput += chunk
          .toString("utf8")
          .slice(0, 4000 - errorOutput.length);
      }
    });
    process.once("error", (error) => finish(error));
    process.once("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(
          new Error(
            errorOutput.trim() ||
              `Report extraction failed with exit code ${code}`,
          ),
        );
        return;
      }
      finish(
        undefined,
        Buffer.concat(output)
          .toString("utf8")
          .slice(0, maximumExtractedCharacters),
      );
    });
    process.stdin.once("error", (error) => finish(error));
    process.stdin.end(file);
  });
}
