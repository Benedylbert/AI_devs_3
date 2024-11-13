import axios from 'axios';
import OpenAI from 'openai';

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Make sure to set your API key as an environment variable
});

async function sendVerificationRequest(): Promise<void> {
  try {
    const responseCentrala = await axios.get('https://centrala.ag3nts.org/data/e2581c1b-8fee-49d3-b7af-42533c7045ca/robotid.json', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(responseCentrala.data.description);

    // Generate image using DALL-E
    try {
      const imageResponse = await client.images.generate({
        model: "dall-e-3",
        prompt: responseCentrala.data.description,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      });

      const imageUrl = imageResponse.data[0].url;
      console.log('Generated image URL:', imageUrl);

      const finalResponse = {
        apikey: 'e2581c1b-8fee-49d3-b7af-42533c7045ca',
        task: 'robotid',
        answer: imageUrl // Use the generated image URL as the answer
      };

      try {
        const finalRequest = await axios.post('https://centrala.ag3nts.org/report', finalResponse, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
    
        console.log('Response:', finalRequest.data);
      } catch (error) {
        console.log('Error sending final verification request, will run again');
        console.log('Retrying...');
      }

    } catch (error) {
      console.error('Error generating image:', error);
    }

  } catch (error) {
    console.error('Error sending verification request:', error);
  }
}

function createSystemPrompt(description: string): string {
  return `
    <objectives>
      generate image with robot based on the description from <information> section. Image need to be with PNG extension. Size need to be 1024x1024.
    </objectives>

    <information>
      ${description}
    </information>
  `;
}

// Execute the function
sendVerificationRequest();
