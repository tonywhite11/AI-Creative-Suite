// FIX: Removed `VideosOperationResponse` as it is not an exported member of '@google/genai'.
import { GoogleGenAI, Modality, Type } from "@google/genai";
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
            // FIX: Updated model name to 'gemini-2.5-flash-image' as per coding guidelines.
            model: 'gemini-2.5-flash-image',
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
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to edit image. The prompt may have been blocked or another error occurred.");
    }
};

export const generateVideo = async (prompt: string, model: string, image?: UploadedImage): Promise<string> => {
    try {
        const payload: {
            model: string;
            prompt: string;
            image?: { imageBytes: string; mimeType: string; };
            config: { numberOfVideos: number; };
        } = {
            model: model,
            prompt: prompt,
            config: {
                numberOfVideos: 1,
            }
        };

        if (image) {
            payload.image = {
                imageBytes: image.base64,
                mimeType: image.mimeType,
            };
        }

        let operation = await ai.models.generateVideos(payload);

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
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
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to generate video. The prompt may have been blocked or another error occurred.");
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
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to generate image. The prompt may have been blocked or another error occurred.");
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
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to enhance prompt. The prompt may have been blocked or another error occurred.");
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
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to enhance music prompt. The prompt may have been blocked or another error occurred.");
    }
};

export interface VideoAnalysisResult {
    sceneDescription: string;
    musicPrompt: string;
}

export const analyzeVideoForSound = async (frames: string[]): Promise<VideoAnalysisResult> => {
    try {
        const imageParts = frames.map(base64Data => ({
            inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg',
            },
        }));

        const prompt = `
            Analyze the following sequence of video frames.
            1.  **Describe the Scene**: Briefly describe the environment, objects, and any actions taking place.
            2.  **Suggest a Soundtrack**: Based on the scene, create a detailed prompt for an AI music generator. The prompt should describe the ideal soundscape, including ambient noises, sound effects, and background music. Specify the mood, genre, instrumentation, and tempo.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    ...imageParts,
                    { text: prompt },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sceneDescription: {
                            type: Type.STRING,
                            description: "A description of the scene, objects, and actions in the video frames."
                        },
                        musicPrompt: {
                            type: Type.STRING,
                            description: "A detailed prompt for an AI music generator, including genre, mood, instruments, and sound effects."
                        }
                    },
                    required: ["sceneDescription", "musicPrompt"]
                }
            }
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        
        if (!result.sceneDescription || !result.musicPrompt) {
            throw new Error("The model did not return the expected analysis structure.");
        }

        return result;

    } catch (error) {
        console.error("Error analyzing video for sound:", error);
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to analyze video. The prompt may have been blocked or another error occurred.");
    }
};

export const suggestDialogue = async (frames: string[]): Promise<string> => {
    try {
        const imageParts = frames.map(base64Data => ({
            inlineData: {
                data: base64Data,
                mimeType: 'image/jpeg',
            },
        }));

        const prompt = `
            Analyze the following sequence of video frames and suggest some brief, creative dialogue that could fit the scene.
            - If there are characters, write a short exchange between them.
            - If there is one character, write a short monologue or thought.
            - If there are no characters, suggest some appropriate voice-over narration.
            Return only the suggested dialogue or narration as a single block of text, without any preamble, formatting, or conversational text. For example, if two characters are speaking, just write the lines:
            "Character 1: [line]"
            "Character 2: [line]"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    ...imageParts,
                    { text: prompt },
                ],
            },
            config: {
                temperature: 0.8,
            },
        });

        const dialogue = response.text.trim();
        if (!dialogue) {
            throw new Error("The model did not return any dialogue suggestions.");
        }
        return dialogue;

    } catch (error) {
        console.error("Error suggesting dialogue:", error);
        if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429'))) {
            throw new Error("API quota exceeded. Please check your API key usage and limits.");
        }
        throw new Error("Failed to suggest dialogue. The prompt may have been blocked or another error occurred.");
    }
};
