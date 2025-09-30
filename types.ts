export enum AppTab {
  Image = 'image',
  Photo = 'photo',
  Video = 'video',
  Music = 'music',
}

export interface UploadedImage {
    base64: string;
    mimeType: string;
    name: string;
}