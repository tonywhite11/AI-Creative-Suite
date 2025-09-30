// FIX: Removed `VideosOperationResponse` as it is not an exported member of '@google/genai'.
import { GoogleGenAI, Modality } from "@google/genai";
import { UploadedImage } from "../types";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface EditImageResult {
    imageUrl: string | null;
    text: string | null;
}

export const editImage = async (images: UploadedImage[], prompt: string): Promise<EditImageResult> => {
    try {
        const imageParts = images.map(image => ({
            inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
            },
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    ...imageParts,
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const result: EditImageResult = { imageUrl: null, text: null };
        if (response.candidates && response.candidates.length > 0) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    result.text = part.text;
                } else if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    result.imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                }
            }
        }
        if (!result.imageUrl) {
            throw new Error("No image was generated. The model may have refused the request.");
        }
        return result;

    } catch (error) {
        console.error("Error editing image:", error);
        throw new Error("Failed to edit image. Please check the console for more details.");
    }
};

export const generateVideo = async (base64ImageData: string, mimeType: string, prompt: string, durationInSeconds: number, model: string): Promise<string> => {
    try {
        let operation = await ai.models.generateVideos({
            model: model,
            prompt: prompt,
            image: {
                imageBytes: base64ImageData,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1,
                // FIX: Corrected property name from `durationInSeconds` to `durationSeconds` to match the API.
                durationSeconds: durationInSeconds,
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            // FIX: Removed the cast to `VideosOperationResponse` because it's not an exported type.
            // The `operation` object is correctly typed through inference.
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }

        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);

    } catch (error) {
        console.error("Error generating video:", error);
        throw new Error("Failed to generate video. Please check the console for more details.");
    }
};

export const generateImages = async (prompt: string, aspectRatio: string): Promise<string> => {
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: aspectRatio,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("No image was generated. The model may have refused the request.");
        }

        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return base64ImageBytes;

    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate image. Please check the console for more details.");
    }
};

export const enhancePrompt = async (currentPrompt?: string): Promise<string> => {
    try {
        let systemInstruction: string;
        let userPrompt: string;

        if (currentPrompt) {
            systemInstruction = "You are a creative assistant that helps write amazing, detailed, and visually rich prompts for an AI image generator. Rewrite and enhance the user's prompt to be more descriptive and imaginative. Return only the enhanced prompt, without any conversational text or preamble.";
            userPrompt = currentPrompt;
        } else {
            systemInstruction = "You are a creative assistant that generates surprising and visually rich prompts for an AI image generator. Provide one creative, descriptive prompt. Return only the prompt, without any conversational text or preamble like 'Here is a prompt:'";
            userPrompt = "Give me a random, creative prompt for an image generator.";
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.9,
            },
        });

        // Trim whitespace and remove quotes if Gemini adds them
        const enhancedText = response.text.trim().replace(/^"|"$/g, ''); 
        if (!enhancedText) {
            throw new Error("The prompt enhancer returned an empty response.");
        }
        return enhancedText;

    } catch (error) {
        console.error("Error enhancing prompt:", error);
        throw new Error("Failed to enhance prompt. Please check the console for details.");
    }
};

export const enhanceMusicPrompt = async (currentPrompt?: string): Promise<string> => {
    try {
        let systemInstruction: string;
        let userPrompt: string;

        if (currentPrompt) {
            systemInstruction = "You are a creative assistant that helps write amazing, detailed, and evocative prompts for an AI music generator called Lyria. Rewrite and enhance the user's prompt to be more descriptive about musical elements like genre, mood, instrumentation, tempo, and texture. Return only the enhanced prompt, without any conversational text or preamble.";
            userPrompt = currentPrompt;
        } else {
            systemInstruction = "You are a creative assistant that generates surprising and descriptive prompts for an AI music generator called Lyria. Provide one creative, detailed prompt describing a piece of music. Include genre, mood, and specific instrumentation. Return only the prompt, without any conversational text or preamble like 'Here is a prompt:'";
            userPrompt = "Give me a random, creative prompt for a music generator.";
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.9,
            },
        });

        // Trim whitespace and remove quotes if Gemini adds them
        const enhancedText = response.text.trim().replace(/^"|"$/g, '');
        if (!enhancedText) {
            throw new Error("The prompt enhancer returned an empty response.");
        }
        return enhancedText;

    } catch (error) {
        console.error("Error enhancing music prompt:", error);
        throw new Error("Failed to enhance music prompt. Please check the console for details.");
    }
};