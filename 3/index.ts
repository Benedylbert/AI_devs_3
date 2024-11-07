import { OpenAIService } from "../OpenAIService";
import type OpenAI from "openai";
import { prompt } from "./prompt";
import { httpGET, httpPOST, httpRequest } from "../httpRequest";
import type { SecretFile, TestData, AnswerFile } from "./model";

const openaiService = new OpenAIService();

const API_KEY = process.env.CENTRALA_KEY!;

const askAI = async (question: string) => {
  const assistantResponse = (await openaiService.completion(
    [
      {
        role: "system",
        content: prompt,
      },
      { content: question, role: "user" },
    ],
    "gpt-4o",
    false
  )) as OpenAI.Chat.Completions.ChatCompletion;

  return assistantResponse.choices[0].message.content;
};

const fixTestData = async (testData: TestData[]) => {
  return await Promise.all(
    testData.map(async ({ question, test }) => {
      const testData: TestData = {
        question,
        answer: eval(question),
      };

      if (test) {
        testData.test = {
          q: test.q,
          a: await askAI(test.q),
        };
      }

      return testData;
    })
  );
};

async function main() {
  try {
    const data = await httpGET<SecretFile>(`https://centrala.ag3nts.org/data/${API_KEY}/json.txt`);

    const fixedData: AnswerFile = {
      task: "JSON",
      apikey: API_KEY,
      answer: {
        apikey: API_KEY,
        copyright: data.copyright,
        description: data.description,
        ["test-data"]: await fixTestData(data["test-data"]),
      },
    };

    const response = await httpPOST(
      "https://centrala.ag3nts.org/report",
      fixedData
    );

    console.log("response:", response);
  } catch (error) {
    console.log(error);
  }
}

main();
