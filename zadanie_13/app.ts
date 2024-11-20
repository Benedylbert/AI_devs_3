import { OpenAIService } from './OpenAIService';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from "openai/resources/chat/completions";
import axios from 'axios';
import type OpenAI from 'openai';
import { json } from 'stream/consumers';

async function sendVerificationRequest(): Promise<void> {

  const openaiService = new OpenAIService();
  try {


    const requestBody = {
      "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
      "task": "database",
      "query": "show tables"
  }


  const responseCentrala = await axios.post('https://centrala.ag3nts.org/apidb', requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
  });

  const finalResponse = responseCentrala.data;

  const tablesArray = finalResponse['reply'];

  const tablesArrayData: { [key: string]: string } = {};

  let tablesString = '';
  let count = 1;

  for (const table of tablesArray) {
    const requestBody = {
      'apikey': 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
      'task': 'database',
      'query': 'show create table ' + table.Tables_in_banan
    }
    
    const responseCentrala = await axios.post('https://centrala.ag3nts.org/apidb', requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    tablesString += 'Table' + count + ': ' + table.Tables_in_banan + '\n'; 
    tablesString += 'Table' + count + ' Definition: ' + responseCentrala.data['reply'][0]["Create Table"] + '\n'; 
    tablesString += '\n';
    count++;
  }

  console.log(tablesString);


    const reponse = await openaiService.completion([
      createSystemPrompt(tablesString)
   ], "gpt-4o") as OpenAI.Chat.Completions.ChatCompletion;

   // Remove "```sql" and "```" from the response
   const cleanedSqlQuery = reponse.choices[0].message.content
     .replace(/```sql\n?/g, '')
     .replace(/```/g, '')
     .trim();

   console.log(cleanedSqlQuery);

   const finalRequestBody = {
    "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
    "task": "database",
    "query": cleanedSqlQuery
}


  const finalResponseCentrala = await axios.post('https://centrala.ag3nts.org/apidb', finalRequestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
  });

 // console.log(finalResponseCentrala.data['reply']);

 const answerArray = []

 for (const row of finalResponseCentrala.data['reply']) {
  console.log(row.dc_id);
  answerArray.push(row.dc_id);
 }

  const finalRequestCentrala = {
    "apikey": "e2581c1b-8fee-49d3-b7af-42533c7045ca",
    "task": "database",
    "answer": answerArray
  }

  try {
    const finalrequest = await axios.post('https://centrala.ag3nts.org/report ', finalRequestCentrala, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

     console.log('Response:', finalrequest.data);
  } catch (error) {
    console.log('Error sending final verification request, will run again');
    console.log(error);
    console.log(finalRequestCentrala);
    console.log(cleanedSqlQuery);
  }


  } catch (error) {
    console.error('Error sending verification request:', error);
  }
}

function createSystemPrompt(tablesString: string): ChatCompletionMessageParam {
    return { 
      role: "system", 
      content: `
      Below you have a list of tables and their definitions in sql. The Databased are connected to each other. check this connections.
      <tables>
        ${tablesString}
      </question>


      <objectives>
        Generate sql query which will return id of active datacenters and manager of this datacenter is already inactive.
      </objectives>


      Return only valid SQL query, no other text or comments. Do not add any additional descrion at the beggining or end of the query.
      
      ` 
    };
  };

// Execute the function
sendVerificationRequest();
