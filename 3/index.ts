import { OpenAIService } from "../OpenAIService";
import type OpenAI from "openai";
import { prompt } from "./prompt";

const openaiService = new OpenAIService();

interface TestData {
  question: string;
  answer: number;
  test?: {
    q: string;
    a: string | null;
  };
}

interface SecretFile {
  apikey: string;
  description: string;
  copyright: string;
  "test-data": TestData[];
}

interface AnswerFile {
  task: string;
  apikey: string;
  answer: SecretFile;
}

const httpRequest = async <T>(
  method: "POST" | "GET" = "GET",
  url: string,
  data?: Record<string, any>
): Promise<T> => {
  const body = data && JSON.stringify(data);

  const response = await fetch(url, {
    method,
    body,
  });
  const responseText = await response.text();
  const responseObject = JSON.parse(responseText);

  return responseObject;
};

const API_KEY = process.env.CENTRALA_KEY!;

const getSecretFile = () => {
  return httpRequest<SecretFile>(
    "GET",
    `https://centrala.ag3nts.org/data/${API_KEY}/json.txt`
  );
};

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
    const data = await getSecretFile();

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

    const response = await httpRequest(
      "POST",
      "https://centrala.ag3nts.org/report",
      fixedData
    );

    console.log("response:", response);
  } catch (error) {
    console.log(error);
  }
}

main();
