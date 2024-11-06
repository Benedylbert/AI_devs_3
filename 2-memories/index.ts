import { OpenAIService } from "../OpenAIService";
import type OpenAI from "openai";
import { useSearchPrompt } from "./prompt";

const openaiService = new OpenAIService();

interface Communication {
  text: string;
  msgID: string;
}

const httpRequest = async (
  text: string = "READY",
  msgID: string = "0"
): Promise<Communication> => {
  const form: Communication = {
    text,
    msgID,
  };
  const body = JSON.stringify(form);
  console.log("request: ", body);

  const response = await fetch("https://xyz.ag3nts.org/verify", {
    method: "POST",
    body,
  });
  const responseText = await response.text();
  const responseObject = JSON.parse(responseText);

  return responseObject;
};

async function main() {
  try {
    const question = await httpRequest();
    console.log("question: ", question.text);

    const assistantResponse = (await openaiService.completion(
      [
        {
          role: "system",
          content: useSearchPrompt,
        },
        { content: question.text, role: "user" },
      ],
      "gpt-4o",
      false
    )) as OpenAI.Chat.Completions.ChatCompletion;

    const answer = assistantResponse.choices[0].message.content;
    console.log("answer: ", answer);

    const response = await httpRequest(`${answer}`, question.msgID);

    console.log("response:", response);
  } catch (error) {
    console.log(error);
  }
}

main();
