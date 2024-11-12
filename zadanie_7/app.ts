import { OpenAIService } from "./OpenAIService";
import type { ChatCompletion, ChatCompletionContentPartImage, ChatCompletionContentPartText, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { readFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import type { ResizedImageMetadata } from "./app.dt";

// Configuration Constants
const zdjecie_1 = join(__dirname, 'zdjecie_1.png');
const zdjecie_2 = join(__dirname, 'zdjecie_2.png');
const zdjecie_3 = join(__dirname, 'zdjecie_3.png');
const zdjecie_4 = join(__dirname, 'zdjecie_4.png');
const OPTIMIZED_IMAGE_PATH = join(__dirname, 'lessons_optimized.png');
const COMPRESSION_LEVEL = 5;
const IMAGE_DETAIL: 'low' | 'high' = 'high';

// Initialize OpenAIService
const openAIService = new OpenAIService();

// Function to process the image
async function processImage(imageUrl: string): Promise<{ imageBase64: string; metadata: ResizedImageMetadata }> {
    try {
        const imageBuffer = readFileSync(imageUrl);
        const resizedImageBuffer = await sharp(imageBuffer)
            .resize(2048, 2048, { fit: 'inside' })
            .png({ compressionLevel: COMPRESSION_LEVEL })
            .toBuffer();

        await sharp(resizedImageBuffer).toFile(OPTIMIZED_IMAGE_PATH);

        const imageBase64 = resizedImageBuffer.toString('base64');
        const metadata = await sharp(resizedImageBuffer).metadata();

        if (!metadata.width || !metadata.height) {
            throw new Error("Unable to retrieve image dimensions.");
        }

        return { imageBase64, metadata: { width: metadata.width, height: metadata.height } };
    } catch (error) {
        console.error("Image processing failed:", error);
        throw error;
    }
}

// Helper function to transform message content
function transformMessageContent(message: ChatCompletionMessageParam): ChatCompletionMessageParam {
    if (typeof message.content === 'string') {
        return { role: message.role, content: message.content } as ChatCompletionMessageParam;
    } else {
        const textContent = message.content?.find((contentPart): contentPart is ChatCompletionContentPartText => 'text' in contentPart)?.text as string;
        return { role: message.role, content: textContent } as ChatCompletionMessageParam;
    }
}

// Main Execution Function
(async () => {
    try {
        const zdjecie_1_data = await processImage(zdjecie_1);
        const zdjecie_2_data = await processImage(zdjecie_2);
        const zdjecie_3_data = await processImage(zdjecie_3);
        const zdjecie_4_data = await processImage(zdjecie_4);
        //const imageTokenCost = await openAIService.calculateImageTokens(metadata.width, metadata.height, IMAGE_DETAIL);
        
        const messages: ChatCompletionMessageParam[] = [
            {
                role: "system",
                content: "You have perfect vision and you are able to recognize cities from maps and bug knowledge about big Poland cities. How the maps with details are looking like. You are also expert of typography."
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${zdjecie_1_data.imageBase64}`,
                            detail: "high"
                        }
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${zdjecie_2_data.imageBase64}`,
                            detail: "high"
                        }
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${zdjecie_3_data.imageBase64}`,
                            detail: "high"
                        }
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${zdjecie_4_data.imageBase64}`,
                            detail: "high"
                        }
                    },
                    {
                        type: "text",
                        text: `On four included images, are part of city map. Maps have streets with names. Showed buildings near to the roads abd shops with names.
                        
                        <objectives>
                        Recognize which city is shown on the maps. Find road intersections and recognized bullding near to them and compare them with othe Poland cities.
                        Three maps are from the same city, one is from different city. City decribed on there three correct maps have granaries and fortresses
                        </objectives>

                        <thinking>
                        Before answer, think about the city names and compare them with each other poland cities. Remember the correct city have granaries and fortresses
                        </thinking>

                        At first return probably city for each map. Then return city which is the most similar to all described maps.
                       
                        `
                    },
                ]
            }
        ];

        const mappedMessages: ChatCompletionMessageParam[] = messages.map(transformMessageContent);
        const textTokenCost = await openAIService.countTokens(mappedMessages);
        


        const chatCompletion = await openAIService.completion(messages, "gpt-4o", false, false, 1024) as ChatCompletion;

        console.log(chatCompletion.choices[0].message.content);
        console.log(`-----------------------------------`);

    } catch (error) {
        console.error("An error occurred during execution:", error);
    }
})();