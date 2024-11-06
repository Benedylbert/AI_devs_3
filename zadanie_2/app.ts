import { OpenAIService } from './OpenAIService';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from "openai/resources/chat/completions";
import axios from 'axios';
import type OpenAI from 'openai';

async function sendVerificationRequest(): Promise<void> {

    const openaiService = new OpenAIService();
  try {
    const requestBody = {
      msgID: 0,
      text: "READY"
    };

    const responseXyz = await axios.get('https://xyz.ag3nts.org/files/0_13_4b.txt', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      //console.log(responseXyz.data);



    const response = await axios.post('https://xyz.ag3nts.org/verify', requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(response.data.text);

    const assistantResponse = await openaiService.completion([
        createSystemPrompt(responseXyz.data, response.data.text)
    ], "gpt-4o") as OpenAI.Chat.Completions.ChatCompletion;

    console.log('xxx')
    console.log(assistantResponse.choices[0].message.content);

    const finalRequestBody = {
        msgID: response.data.msgID,
        text: assistantResponse.choices[0].message.content
      }

      try {
        const finalResponse = await axios.post('https://xyz.ag3nts.org/verify', finalRequestBody, {
            headers: {
              'Content-Type': 'application/json'
            }
          });
    
         console.log('Response:', finalResponse.data);
      } catch (error) {
        console.log('Error sending final verification request, will run again');
        sendVerificationRequest();
      }
  } catch (error) {
    console.error('Error sending verification request:', error);
  }
}

function createSystemPrompt(instructions: string, question: string): ChatCompletionMessageParam {
    return { 
      role: "system", 
      content: `
      from this what is inside the context you should take care only about this what is inside section ******** Uwaga! ********. You just only need to response for question which is inside <question>...</question> tag.
      So context will help you with. Return response in english language.
      <context>
        You are Alice, a helpful assistant who speaks using as few words as possible.
      </context>
      <question>
        ${question}
      </question>
      ` 
    };
  };

// Execute the function
sendVerificationRequest();
