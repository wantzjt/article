import { generateSpeech, gateway } from "ai";
import { TTS_MODEL } from "./constants";

export type Synthesize = (input: {
  text: string;
  topicId: string;
}) => Promise<{ bytes: Buffer; contentType: string }>;

export const synthesizeWithGateway: Synthesize = async ({ text, topicId }) => {
  const result = await generateSpeech({
    model: gateway.speech(TTS_MODEL),
    text,
    outputFormat: "mp3",
    providerOptions: {
      gateway: {
        tags: ["stage:tts", `topic_id:${topicId}`],
      },
    },
  });
  return {
    bytes: Buffer.from(result.audio.uint8Array),
    contentType: result.audio.mediaType || "audio/mpeg",
  };
};
