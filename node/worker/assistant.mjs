import { voice } from "@livekit/agents";

const ASSISTANT_INSTRUCTIONS =
  "You are a concise POS assistant. Keep answers short and practical for store cashiers.";

export class Assistant extends voice.Agent {
  constructor() {
    super({
      instructions: ASSISTANT_INSTRUCTIONS,
    });
  }
}
