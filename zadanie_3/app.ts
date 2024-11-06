import { OpenAIService } from './OpenAIService';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from "openai/resources/chat/completions";
import axios from 'axios';
import type OpenAI from 'openai';
import { json } from 'stream/consumers';

async function sendVerificationRequest(): Promise<void> {

  const openaiService = new OpenAIService();
  try {
    

    const responseCentrala = await axios.get('https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/json.txt', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const finalResponse = responseCentrala.data

      finalResponse.apikey = 'e2581c1b-8fee-49d3-b7af-42533c7045ca'

      const testData = finalResponse['test-data']

      for (const item of testData) {
        item.answer = eval(item.question)
        if (item.test != null) {
          const reponse = await openaiService.completion([
              createSystemPrompt(item.test.q)
           ], "gpt-4o") as OpenAI.Chat.Completions.ChatCompletion;

         item.test.a = reponse.choices[0].message.content
        }
      }
      finalResponse['test-data'] = testData

      console.log('lecimy');


      const finalBody = {
        task: "JSON",
        apikey: "e2581c1b-8fee-49d3-b7af-42533c7045ca",
        answer: finalResponse
      };

      try {
        const finalResponse = await axios.post('https://centrala.ag3nts.org/report ', finalBody, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
    
         console.log('Response:', finalResponse.data);
      } catch (error) {
        console.log('Error sending final verification request, will run again');
      }

  } catch (error) {
    console.error('Error sending verification request:', error);
  }
}

function createSystemPrompt(question: string): ChatCompletionMessageParam {
    return { 
      role: "system", 
      content: `
      Return only the answer, no other text.
      <question>
        ${question}
      </question>
      ` 
    };
  };

// Execute the function
sendVerificationRequest();
